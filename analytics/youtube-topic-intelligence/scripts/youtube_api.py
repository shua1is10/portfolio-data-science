"""
youtube_api.py
Ingestion via YouTube Data API v3 (solo stdlib: urllib).

Muestreo: search.list estratificado por MES x QUERY (publishedAfter/Before), para que la
muestra no se concentre en una parte de la ventana. search.list devuelve una seleccion
ordenada por el algoritmo (order=relevance): es una muestra curada, no un censo
(ver RESEARCH_NOTES.md, sesgo de seleccion).

Cuota (10,000 u/dia por defecto):
  search.list = 100 u/pagina · videos.list = 1 u/50 ids · channels.list = 1 u/50 ids
  commentThreads.list = 1 u/video

Privacidad: de los comentarios solo se guardan texto, likeCount y si los escribio el dueno
del canal (booleano); nunca el autor ni su canal.
"""

from __future__ import annotations

import json
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from typing import Any, Iterator

from config import (
    COMMENTS_PER_VIDEO, PERIODS, QUOTA_BUDGET, REQUEST_PAUSE_S, RESULTS_PER_QUERY_MONTH,
    SEARCH_QUERIES, SEED,
)

API = "https://www.googleapis.com/youtube/v3/"
_ISO_DURATION = re.compile(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?")


class QuotaExceeded(RuntimeError):
    pass


class QuotaTracker:
    COST = {"search": 100, "videos": 1, "channels": 1, "commentThreads": 1}

    def __init__(self, budget: int) -> None:
        self.budget, self.used = budget, 0
        self.calls: dict[str, int] = {}

    def spend(self, endpoint: str) -> None:
        cost = self.COST[endpoint]
        if self.used + cost > self.budget:
            raise QuotaExceeded(f"Presupuesto de cuota agotado ({self.used}/{self.budget} u).")
        self.used += cost
        self.calls[endpoint] = self.calls.get(endpoint, 0) + 1


def parse_iso8601_duration(value: str) -> int:
    """'PT1H2M3S' -> 3723 segundos. Directos sin duracion ('P0D') -> 0."""
    m = _ISO_DURATION.fullmatch(value or "")
    if not m:
        return 0
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _get(endpoint: str, params: dict[str, Any], key: str, quota: QuotaTracker,
         retries: int = 4) -> dict[str, Any]:
    quota.spend(endpoint)
    url = API + endpoint + "?" + urllib.parse.urlencode({**params, "key": key})
    for attempt in range(retries):
        time.sleep(REQUEST_PAUSE_S)
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            reason = _error_reason(body)
            # comentarios desactivados / video sin acceso: no es un fallo del pipeline
            if exc.code in (403, 404) and reason in ("commentsDisabled", "videoNotFound", "forbidden"):
                return {"items": []}
            if reason in ("quotaExceeded", "dailyLimitExceeded"):
                raise QuotaExceeded(f"{endpoint}: la API reporta cuota diaria agotada") from exc
            if exc.code in (429, 500, 503) and attempt < retries - 1:
                time.sleep(2 ** attempt)   # backoff exponencial
                continue
            # nunca incluir la URL (lleva la API key) en el mensaje
            raise RuntimeError(f"{endpoint} HTTP {exc.code} ({reason})") from exc
        except urllib.error.URLError as exc:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"{endpoint}: error de red ({exc.reason})") from exc
    raise RuntimeError(f"{endpoint}: reintentos agotados")


def _error_reason(body: str) -> str:
    try:
        errors = json.loads(body).get("error", {}).get("errors", [])
        return errors[0].get("reason", "unknown") if errors else "unknown"
    except (ValueError, AttributeError):
        return "unknown"


def _month_windows() -> Iterator[tuple[str, date, date]]:
    for period in PERIODS:
        for month in range(period.start.month, period.end.month + 1):
            start = date(period.start.year, month, 1)
            end = date(period.start.year + (month == 12), month % 12 + 1, 1)
            yield period.key, start, end


def _chunks(items: list[str], size: int = 50) -> Iterator[list[str]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _search_stratum(query: str, start: date, end: date, key: str, quota: QuotaTracker) -> list[str]:
    """IDs de un estrato mes x query, paginando con nextPageToken hasta el objetivo."""
    ids: list[str] = []
    token: str | None = None
    while len(ids) < RESULTS_PER_QUERY_MONTH:
        params: dict[str, Any] = {
            "part": "id", "type": "video", "q": query,
            "maxResults": min(50, RESULTS_PER_QUERY_MONTH - len(ids)),
            "order": "relevance", "relevanceLanguage": "en", "safeSearch": "none",
            "publishedAfter": f"{start.isoformat()}T00:00:00Z",
            "publishedBefore": f"{end.isoformat()}T00:00:00Z",
        }
        if token:
            params["pageToken"] = token
        data = _get("search", params, key, quota)
        ids.extend(item["id"]["videoId"] for item in data.get("items", []) if item["id"].get("videoId"))
        token = data.get("nextPageToken")
        if not token:
            break
    return ids


def fetch(key: str) -> dict[str, Any]:
    """Descarga y devuelve el payload crudo (se guarda tal cual en data/raw/)."""
    quota = QuotaTracker(QUOTA_BUDGET)
    strata: dict[str, dict[str, Any]] = {}
    for period_key, start, end in _month_windows():
        for query in SEARCH_QUERIES:
            for vid in _search_stratum(query, start, end, key, quota):
                strata.setdefault(vid, {"period": period_key, "month": start.month, "queries": []})
                strata[vid]["queries"].append(query)
        print(f"  search {start:%Y-%m}: {len(strata)} IDs unicos acumulados")

    videos: list[dict[str, Any]] = []
    for chunk in _chunks(list(strata)):
        data = _get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(chunk)}, key, quota)
        videos.extend(data.get("items", []))

    channel_ids = sorted({v["snippet"]["channelId"] for v in videos})
    channels: dict[str, Any] = {}
    for chunk in _chunks(channel_ids):
        data = _get("channels", {"part": "statistics", "id": ",".join(chunk)}, key, quota)
        channels.update({c["id"]: c for c in data.get("items", [])})

    # Orden aleatorio: si la cuota se agota, la perdida de comentarios no cae en un solo periodo.
    order = videos[:]
    random.Random(SEED).shuffle(order)
    comments: dict[str, list[dict[str, Any]]] = {}
    truncated = False
    for v in order:
        if int(v.get("statistics", {}).get("commentCount", 0) or 0) == 0:
            continue
        try:
            data = _get("commentThreads", {
                "part": "snippet", "videoId": v["id"], "maxResults": COMMENTS_PER_VIDEO,
                "order": "relevance", "textFormat": "plainText",
            }, key, quota)
        except QuotaExceeded:
            truncated = True
            print(f"  [cuota] comentarios truncados tras {len(comments)} videos")
            break
        owner = v["snippet"]["channelId"]
        comments[v["id"]] = [
            {"text": s["textOriginal"], "likes": int(s.get("likeCount", 0) or 0),
             # solo un booleano: el ID del autor nunca se guarda
             "by_owner": s.get("authorChannelId", {}).get("value") == owner}
            for s in (t["snippet"]["topLevelComment"]["snippet"] for t in data.get("items", []))
        ]

    print(f"  cuota usada: {quota.used} u {quota.calls} · videos: {len(videos)} · "
          f"con comentarios: {len(comments)}")
    return {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "queries": list(SEARCH_QUERIES),
        "results_per_query_month": RESULTS_PER_QUERY_MONTH,
        "quota_used": quota.used,
        "quota_calls": quota.calls,
        "comments_truncated": truncated,
        "strata": strata,
        "videos": videos,
        "channels": channels,
        "comments": comments,
    }


def normalize(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Payload crudo de la API -> registros planos por video."""
    out: list[dict[str, Any]] = []
    for v in payload["videos"]:
        sn, st, cd = v["snippet"], v.get("statistics", {}), v.get("contentDetails", {})
        ch = payload["channels"].get(sn["channelId"], {}).get("statistics", {})
        out.append({
            "video_id": v["id"],
            "title": sn.get("title", ""),
            "description": sn.get("description", ""),
            "tags": sn.get("tags", []),
            "language": (sn.get("defaultAudioLanguage") or sn.get("defaultLanguage") or "").lower(),
            "live": sn.get("liveBroadcastContent", "none"),
            "channel_id": sn["channelId"],
            # hiddenSubscriberCount -> None (no 0, que sesgaria hacia canales pequenos)
            "subscriber_count": None if ch.get("hiddenSubscriberCount") else int(ch.get("subscriberCount", 0) or 0),
            "published_at": sn["publishedAt"],
            "duration_s": parse_iso8601_duration(cd.get("duration", "")),
            "views": int(st.get("viewCount", 0) or 0),
            # likes ocultos por el creador -> None, se excluyen del ratio (no se imputan como 0)
            "likes": int(st["likeCount"]) if "likeCount" in st else None,
            "comment_count": int(st["commentCount"]) if "commentCount" in st else None,
            "comments": payload["comments"].get(v["id"], []),
        })
    return out
