"""
youtube_api.py
Ingestion real via YouTube Data API v3 (solo stdlib: urllib). Requiere YOUTUBE_API_KEY.

Diseno de muestreo: search.list estratificado por MES (publishedAfter/Before) y por query,
para que la muestra no se concentre al final de la ventana. search.list devuelve una
seleccion ordenada por el algoritmo (order=relevance): es una muestra curada, no un censo
(ver RESEARCH_NOTES.md §4, sesgo de seleccion).

Cuota (10,000 unidades/dia por defecto):
  search.list = 100 u/pagina · videos.list = 1 u/50 ids · channels.list = 1 u/50 ids
  commentThreads.list = 1 u/video
"""

from __future__ import annotations

import json
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from typing import Any, Iterator

from config import PERIODS, SEARCH_QUERIES, SEED

API = "https://www.googleapis.com/youtube/v3/"
_ISO_DURATION = re.compile(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?")


class QuotaTracker:
    COST = {"search": 100, "videos": 1, "channels": 1, "commentThreads": 1}

    def __init__(self, budget: int) -> None:
        self.budget, self.used = budget, 0

    def spend(self, endpoint: str) -> None:
        cost = self.COST[endpoint]
        if self.used + cost > self.budget:
            raise RuntimeError(f"Presupuesto de cuota agotado ({self.used}/{self.budget} u).")
        self.used += cost


def parse_iso8601_duration(value: str) -> int:
    """'PT1H2M3S' -> 3723 segundos. Directos sin duracion ('P0D') -> 0."""
    m = _ISO_DURATION.fullmatch(value or "")
    if not m:
        return 0
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _get(endpoint: str, params: dict[str, Any], key: str, quota: QuotaTracker,
         retries: int = 3) -> dict[str, Any]:
    quota.spend(endpoint)
    url = API + endpoint + "?" + urllib.parse.urlencode({**params, "key": key})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            # comentarios desactivados: no es un error del pipeline
            if exc.code == 403 and "commentsDisabled" in body:
                return {"items": []}
            if exc.code in (500, 503) and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"{endpoint} HTTP {exc.code}: {body[:300]}") from exc
    raise RuntimeError(f"{endpoint}: reintentos agotados")


def _month_windows() -> Iterator[tuple[str, date, date]]:
    for period in PERIODS:
        for month in range(period.start.month, period.end.month + 1):
            start = date(period.start.year, month, 1)
            end = date(period.start.year + (month == 12), month % 12 + 1, 1)
            yield period.key, start, end


def _chunks(items: list[str], size: int = 50) -> Iterator[list[str]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def fetch(key: str, pages_per_month: int = 1, comments_per_video: int = 20,
          quota_budget: int = 9_500) -> dict[str, Any]:
    """Descarga y devuelve el payload crudo (se cachea tal cual en data/raw/)."""
    quota = QuotaTracker(quota_budget)
    ids: dict[str, None] = {}
    for _period, start, end in _month_windows():
        for query in SEARCH_QUERIES:
            token: str | None = None
            for _ in range(pages_per_month):
                params = {
                    "part": "id", "type": "video", "q": query, "maxResults": 50,
                    "order": "relevance", "relevanceLanguage": "en",
                    "publishedAfter": f"{start.isoformat()}T00:00:00Z",
                    "publishedBefore": f"{end.isoformat()}T00:00:00Z",
                }
                if token:
                    params["pageToken"] = token
                data = _get("search", params, key, quota)
                for item in data.get("items", []):
                    ids.setdefault(item["id"]["videoId"], None)
                token = data.get("nextPageToken")
                if not token:
                    break

    videos: list[dict[str, Any]] = []
    for chunk in _chunks(list(ids)):
        data = _get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(chunk)}, key, quota)
        videos.extend(data.get("items", []))

    channel_ids = sorted({v["snippet"]["channelId"] for v in videos})
    channels: dict[str, Any] = {}
    for chunk in _chunks(channel_ids):
        data = _get("channels", {"part": "statistics", "id": ",".join(chunk)}, key, quota)
        channels.update({c["id"]: c for c in data.get("items", [])})

    # Orden aleatorio: si la cuota se agota, la perdida de comentarios no cae en un solo periodo.
    comment_order = videos[:]
    random.Random(SEED).shuffle(comment_order)
    comments: dict[str, list[str]] = {}
    for v in comment_order:
        if int(v.get("statistics", {}).get("commentCount", 0) or 0) == 0:
            continue
        try:
            data = _get("commentThreads", {
                "part": "snippet", "videoId": v["id"], "maxResults": comments_per_video,
                "order": "relevance", "textFormat": "plainText",
            }, key, quota)
        except RuntimeError as exc:
            if "Presupuesto" in str(exc):
                print(f"  [cuota] comentarios truncados en {len(comments)} videos")
                break
            raise
        comments[v["id"]] = [
            t["snippet"]["topLevelComment"]["snippet"]["textOriginal"] for t in data.get("items", [])
        ]

    print(f"  cuota usada: {quota.used} u · videos: {len(videos)} · con comentarios: {len(comments)}")
    return {"videos": videos, "channels": channels, "comments": comments}


def normalize(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Payload crudo de la API -> esquema comun (identico al de synthetic.generate)."""
    out: list[dict[str, Any]] = []
    for v in payload["videos"]:
        sn, st, cd = v["snippet"], v.get("statistics", {}), v.get("contentDetails", {})
        if sn.get("liveBroadcastContent", "none") != "none":
            continue   # directos en curso: metricas incompletas
        ch = payload["channels"].get(sn["channelId"], {}).get("statistics", {})
        out.append({
            "video_id": v["id"],
            "title": sn.get("title", ""),
            "tags": sn.get("tags", []),
            "channel_id": sn["channelId"],
            "channel_title": sn.get("channelTitle", ""),
            # hiddenSubscriberCount -> None (no 0, que sesgaria hacia canales pequenos)
            "subscriber_count": None if ch.get("hiddenSubscriberCount") else int(ch.get("subscriberCount", 0) or 0),
            "published_at": sn["publishedAt"],
            "duration_s": parse_iso8601_duration(cd.get("duration", "")),
            "views": int(st.get("viewCount", 0) or 0),
            # likes ocultos por el creador -> None, se excluyen del EER (no se imputan como 0)
            "likes": int(st["likeCount"]) if "likeCount" in st else None,
            "comments": int(st["commentCount"]) if "commentCount" in st else None,
            "comment_texts": payload["comments"].get(v["id"], []),
        })
    return out
