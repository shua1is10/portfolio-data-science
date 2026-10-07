"""
extract_and_process.py
Pipeline de produccion: ingesta (YouTube Data API v3) -> limpieza -> features -> NLP ->
inferencia -> exportacion.

Uso (desde cualquier directorio, con el entorno de analytics/.venv):
  analytics/.venv/bin/python analytics/youtube-topic-intelligence/scripts/extract_and_process.py
  ... --refresh     # vuelve a descargar (gasta ~4,000 u de cuota) en lugar de usar data/raw/

La clave se lee de YOUTUBE_API_KEY (entorno) o de .env.local / .env en la raiz del repo.

Salidas:
  analytics/youtube-topic-intelligence/data/raw/youtube_topic_raw.json      crudo (gitignored)
  analytics/youtube-topic-intelligence/data/processed/youtube_insights.json  registros + resumen
  data/youtube-topic-intelligence/insights_summary.json                      case study (fs)
  public/data/youtube-topic-intelligence/videos.json                         filas compactas (fetch)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Iterable

import narrative
import nlp
import stats
import youtube_api
from config import (
    AGE_BAND_DAYS, ALPHA, BOOTSTRAP_RESAMPLES, CATEGORIES, DURATION_BINS, ENV_FILES, FORMATS,
    MATURITY_DAYS, MIN_COMMENTS_FOR_SENTIMENT, MIN_GROUP_N, MIN_VIEWS, NEGATIVE_THRESHOLD,
    OTHER_CATEGORY, PERIODS, POSITIVE_THRESHOLD, PROCESSED_DIR, PROMO_BRANDS, RAW_FILE, RELEVANCE_TERMS, REPO,
    SEED, SENTIMENT_BUCKETS, TOPIC, WEB_PUBLIC_DIR, WEB_SERVER_DIR,
)

Record = dict[str, Any]
CATEGORY_KEYS = [c[0] for c in CATEGORIES] + [OTHER_CATEGORY[0]]
CATEGORY_LABELS = {c[0]: c[1] for c in CATEGORIES} | {OTHER_CATEGORY[0]: OTHER_CATEGORY[1]}
FORMAT_KEYS = [f[0] for f in FORMATS]
FORMAT_LABELS = {f[0]: f[1] for f in FORMATS}
_RELEVANCE = re.compile(r"\b(" + "|".join(re.escape(t) for t in RELEVANCE_TERMS) + r")\b")
_HAS_LINK = re.compile(r"https?://|www\.|\b[a-z0-9-]+\.(com|io|ai|co|gg|ly|me)/", re.IGNORECASE)
_SPANISH_STOP = frozenset("de la el en que y los las un una para con por cómo como qué es del se tu mi".split())


# =============================================================================
# 1. Ingesta
# =============================================================================
def load_api_key() -> str:
    """YOUTUBE_API_KEY del entorno o de .env.local/.env. Nunca se imprime ni se registra."""
    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if key:
        return key
    try:
        from dotenv import dotenv_values
        for path in ENV_FILES:
            if path.exists():
                key = (dotenv_values(path).get("YOUTUBE_API_KEY") or "").strip()
                if key:
                    return key
    except ImportError:
        # fallback sin dependencia: KEY=VALUE simple
        for path in ENV_FILES:
            if path.exists():
                for line in path.read_text(encoding="utf-8").splitlines():
                    k, _, v = line.partition("=")
                    if k.strip() == "YOUTUBE_API_KEY" and v.strip():
                        return v.strip().strip("'\"")
    raise SystemExit("Falta YOUTUBE_API_KEY (entorno o .env.local en la raiz del repo).")


def load_raw(refresh: bool) -> dict[str, Any]:
    if RAW_FILE.exists() and not refresh:
        print(f"[1/5] Usando dataset crudo en cache: {RAW_FILE.relative_to(REPO)}")
        return json.loads(RAW_FILE.read_text(encoding="utf-8"))
    print("[1/5] Descargando de YouTube Data API v3...")
    payload = youtube_api.fetch(load_api_key())
    RAW_FILE.parent.mkdir(parents=True, exist_ok=True)
    RAW_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


# =============================================================================
# 2. Limpieza + features
# =============================================================================
def _period_of(d: date) -> str | None:
    for p in PERIODS:
        if p.start <= d <= p.end:
            return p.key
    return None


def _interval(value: float, edges: Iterable[tuple[str, float, float]]) -> int:
    """Intervalos (lo, hi], los mismos que usa el dashboard."""
    for i, (_label, lo, hi) in enumerate(edges):
        if lo < value <= hi:
            return i
    return -1


def _sentiment_bucket(value: float) -> int:
    for i, (_label, lo, hi) in enumerate(SENTIMENT_BUCKETS):
        if lo <= value < hi:
            return i
    return -1


def _format_of(duration_s: float) -> str:
    for key, _label, lo, hi in FORMATS:
        if lo < duration_s <= hi:
            return key
    return FORMAT_KEYS[-1]


def _english_title(title: str) -> bool:
    letters = [c for c in title if c.isalpha()]
    if letters and sum(1 for c in letters if not c.isascii()) / len(letters) > 0.15:
        return False   # alfabetos no latinos
    words = re.findall(r"[a-záéíóúñü]+", title.lower())
    return sum(1 for w in words if w in _SPANISH_STOP) < 2 or any(w in nlp._EN_STOP for w in words)


def _norm_comment(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"https?://\S+", "", text.lower())).strip()


def _is_promo(text: str) -> bool:
    squashed = re.sub(r"[\s\-_]+", "", text.lower())
    return any(b in squashed for b in PROMO_BRANDS)


def _spam_texts(raw: list[Record], min_videos: int = 3) -> set[str]:
    """Comentarios identicos (tras normalizar) en >= min_videos videos distintos: spam de
    bots que pega el mismo texto con un enlace. Inflan terminos y sentimiento."""
    where: dict[str, set[str]] = defaultdict(set)
    for v in raw:
        for c in v["comments"]:
            norm = _norm_comment(c["text"])
            if len(norm) >= 15:
                where[norm].add(v["video_id"])
    return {text for text, vids in where.items() if len(vids) >= min_videos}


def spam_report(raw: list[Record], min_videos: int = 8) -> list[dict[str, Any]]:
    """Candidatos a marca promocional, para REVISION HUMANA (no filtra nada por si solo).
    Firma de campana: nombre propio (capitalizado fuera de inicio de frase) que aparece en
    comentarios de muchos videos distintos, ~1 vez por video, y nunca en el titulo, la
    descripcion ni los tags de esos videos. Da falsos positivos ('Cheers', 'Thankyou'):
    por eso la lista final (PROMO_BRANDS) la confirma una persona."""
    videos: dict[str, set[str]] = defaultdict(set)
    mentions: dict[str, int] = defaultdict(int)
    capitalized: dict[str, int] = defaultdict(int)
    for v in raw:
        meta = re.sub(r"\s+", "", f"{v['title']} {v['description']} {' '.join(v['tags'])}".lower())
        for c in v["comments"]:
            text = re.sub(r"https?://\S+", "", c["text"])
            for m in re.finditer(r"[A-Za-z][A-Za-z0-9]{3,}(?:\s[A-Z][A-Za-z0-9]+)?", text):
                key = m.group(0).lower().replace(" ", "")
                if key in meta or key in nlp.STOPWORDS:
                    continue
                videos[key].add(v["video_id"])
                mentions[key] += 1
                capitalized[key] += int(m.group(0)[0].isupper() and m.start() > 0)
    out = [
        {"term": k, "videos": len(vs), "mentions": mentions[k],
         "capitalized_share": round(capitalized[k] / mentions[k], 2),
         "confirmed": k in PROMO_BRANDS}
        for k, vs in videos.items()
        if len(vs) >= min_videos and capitalized[k] / mentions[k] >= 0.6 and mentions[k] / len(vs) <= 2.5
    ]
    return sorted(out, key=lambda r: -r["videos"])


def build_features(payload: dict[str, Any]) -> tuple[list[Record], dict[str, int], list[float], date]:
    print("[2/5] Limpieza, features y NLP...")
    snapshot = datetime.fromisoformat(payload["fetched_at"].replace("Z", "+00:00")).date()
    raw = youtube_api.normalize(payload)
    audit: dict[str, int] = defaultdict(int)
    audit["raw_videos"] = len(raw)
    audit["quota_used"] = payload.get("quota_used", 0)
    seen: set[str] = set()
    records: list[Record] = []
    spam = _spam_texts(raw)
    candidates = spam_report(raw)
    unreviewed = [c["term"] for c in candidates if not c["confirmed"]]
    print(f"  spam_report: {len(candidates)} candidatos ({len(unreviewed)} sin confirmar, revisar: {unreviewed[:8]})")

    for v in raw:
        if v["video_id"] in seen:
            audit["dropped_duplicates"] += 1
            continue
        seen.add(v["video_id"])
        published = datetime.fromisoformat(v["published_at"].replace("Z", "+00:00")).date()
        period = _period_of(published)
        if period is None:
            audit["dropped_out_of_window"] += 1
            continue
        if v["live"] != "none" or v["duration_s"] <= 0:
            audit["dropped_live_or_no_duration"] += 1
            continue
        if (v["language"] and not v["language"].startswith("en")) or not _english_title(v["title"]):
            audit["dropped_non_english"] += 1
            continue
        haystack = f"{v['title']} {v['description'][:1000]} {' '.join(v['tags'])}".lower()
        if not _RELEVANCE.search(haystack):
            audit["dropped_off_topic"] += 1
            continue

        age = max((snapshot - published).days, 1)
        views = v["views"]
        mature = age >= MATURITY_DAYS
        if not mature:
            audit["immature_excluded_from_velocity"] += 1

        engagement_ratio = like_rate = comment_rate = None
        if v["likes"] is None or v["comment_count"] is None:
            audit["engagement_missing_hidden_counts"] += 1
        elif views < MIN_VIEWS:
            audit["engagement_excluded_low_views"] += 1
        else:
            engagement_ratio = (v["likes"] + v["comment_count"]) / views * 100
            like_rate = v["likes"] / views * 100
            comment_rate = v["comment_count"] / views * 100

        audit["comments_fetched"] += len(v["comments"])
        # Se excluyen del sentimiento: comentarios del propio creador y con enlaces (casi siempre
        # autopromocion: "join my community"), spam duplicado entre videos y astroturfing de marca.
        own_or_link = [c for c in v["comments"] if c.get("by_owner") or _HAS_LINK.search(c["text"])]
        dupes = [c for c in v["comments"] if c not in own_or_link and _norm_comment(c["text"]) in spam]
        promo = [c for c in v["comments"] if c not in own_or_link and c not in dupes and _is_promo(c["text"])]
        organic = [c for c in v["comments"] if c not in own_or_link and c not in dupes and c not in promo]
        audit["comments_dropped_creator_or_link"] += len(own_or_link)
        audit["comments_dropped_duplicate_spam"] += len(dupes)
        audit["comments_dropped_promotional"] += len(promo)
        scored = [{**c, "compound": nlp.score_sentiment(c["text"])}
                  for c in organic if nlp.looks_english(c["text"])]
        audit["comments_scored_english"] += len(scored)
        classes = [nlp.sentiment_class(c["compound"]) for c in scored]
        sentiment = (stats.mean([c["compound"] for c in scored]) * 100
                     if len(scored) >= MIN_COMMENTS_FOR_SENTIMENT else None)

        records.append({
            "video_id": v["video_id"],
            "title": v["title"],
            "channel_id": v["channel_id"],
            "subscriber_count": v["subscriber_count"],
            "period": period,
            "published": published.isoformat(),
            "month": published.month,
            "age_days": age,
            "duration_s": v["duration_s"],
            "format": _format_of(v["duration_s"]),
            "duration_bin": _interval(v["duration_s"], DURATION_BINS),
            "category": nlp.classify_category(v["title"], v["tags"]),
            "views": views,
            "likes": v["likes"],
            "comment_count": v["comment_count"],
            "mature": mature,
            "daily_velocity": views / age if mature else None,
            "engagement_ratio": engagement_ratio,
            "like_rate": like_rate,
            "comment_rate": comment_rate,
            "sentiment_index": sentiment,
            "sentiment_bucket": _sentiment_bucket(sentiment) if sentiment is not None else -1,
            "comments_scored": len(scored),
            "promo_comments": len(promo),
            "promo_brands": sorted({b for c in promo for b in PROMO_BRANDS if b in re.sub(r"[\s\-_]+", "", c["text"].lower())}),
            "positive_comments": classes.count("positive"),
            "neutral_comments": classes.count("neutral"),
            "negative_comments": classes.count("negative"),
            "_scored_comments": scored,   # solo en memoria (citas y terminos); no se exporta
        })

    rvi_edges = _add_relative_velocity(records)
    audit["analyzed_videos"] = len(records)
    return records, dict(audit), rvi_edges, snapshot


def _add_relative_velocity(records: list[Record]) -> list[float]:
    """Relative Velocity Index: velocidad / mediana de su periodo y franja de edad (30 d).
    Neutraliza la edad DENTRO de cada periodo; no hace comparables los periodos entre si.
    Devuelve los cortes globales de quintil del RVI."""
    groups: dict[tuple[str, int], list[float]] = defaultdict(list)
    period_all: dict[str, list[float]] = defaultdict(list)
    for r in records:
        if r["daily_velocity"] is not None:
            groups[(r["period"], r["age_days"] // AGE_BAND_DAYS)].append(r["daily_velocity"])
            period_all[r["period"]].append(r["daily_velocity"])
    medians = {k: stats.median(v) for k, v in groups.items() if len(v) >= 8}
    period_medians = {k: stats.median(v) for k, v in period_all.items()}
    for r in records:
        if r["daily_velocity"] is None:
            r["rvi"] = None
            continue
        ref = medians.get((r["period"], r["age_days"] // AGE_BAND_DAYS), period_medians[r["period"]])
        r["rvi"] = r["daily_velocity"] / ref if ref else None

    rvis = [r["rvi"] for r in records if r["rvi"] is not None]
    edges = [stats.quantile(rvis, q) for q in (0.2, 0.4, 0.6, 0.8)]
    for r in records:
        r["rvi_quintile"] = -1 if r["rvi"] is None else sum(1 for e in edges if r["rvi"] > e)
    return edges


# =============================================================================
# 3. Analisis estadistico
# =============================================================================
def _vals(rs: Iterable[Record], field: str) -> list[float]:
    return [r[field] for r in rs if r[field] is not None]


def _by(records: list[Record], pred: Callable[[Record], bool]) -> list[Record]:
    return [r for r in records if pred(r)]


def compare_medians(prev: list[float], curr: list[float], rng: random.Random) -> dict[str, Any]:
    mp, mc = stats.median(prev), stats.median(curr)
    enough = len(prev) >= MIN_GROUP_N and len(curr) >= MIN_GROUP_N
    lo, hi = (stats.bootstrap_median_change(prev, curr, BOOTSTRAP_RESAMPLES, rng)
              if enough else (math.nan, math.nan))
    p = stats.mann_whitney_u(prev, curr)[1] if enough else math.nan
    return {
        "n_prev": len(prev), "n_curr": len(curr),
        "median_prev": mp, "median_curr": mc,
        "change_pct": stats.pct_change(mc, mp),
        "ci95": [lo, hi],
        "p_value": p,
        "q_value": None,   # se completa con Benjamini-Hochberg sobre toda la familia
        "cliffs_delta": stats.cliffs_delta(prev, curr) if enough else math.nan,
    }


def comment_shares(rs: list[Record]) -> dict[str, Any]:
    n = sum(r["comments_scored"] for r in rs)
    pos = sum(r["positive_comments"] for r in rs)
    neg = sum(r["negative_comments"] for r in rs)
    neu = sum(r["neutral_comments"] for r in rs)

    def pct(x: int) -> float:
        return x / n * 100 if n else math.nan

    return {"n": n, "positive": pos, "neutral": neu, "negative": neg,
            "positive_pct": pct(pos), "neutral_pct": pct(neu), "negative_pct": pct(neg)}


def analyze(records: list[Record], audit: dict[str, int], snapshot: date,
            payload: dict[str, Any]) -> dict[str, Any]:
    print("[3/5] Analisis estadistico (bootstrap x%d)..." % BOOTSTRAP_RESAMPLES)
    rng = random.Random(SEED)
    prev = _by(records, lambda r: r["period"] == "prev")
    curr = _by(records, lambda r: r["period"] == "curr")
    pvals: dict[str, float] = {}

    def period_kpis(rs: list[Record]) -> dict[str, Any]:
        return {
            "videos": len(rs),
            "channels": len({r["channel_id"] for r in rs}),
            "median_age_days": stats.median([r["age_days"] for r in rs]),
            "median_views": stats.median([r["views"] for r in rs]),
            "median_daily_velocity": stats.median(_vals(rs, "daily_velocity")),
            "median_engagement_ratio": stats.median(_vals(rs, "engagement_ratio")),
            "median_like_rate": stats.median(_vals(rs, "like_rate")),
            "median_comment_rate": stats.median(_vals(rs, "comment_rate")),
            "mean_sentiment_index": stats.mean(_vals(rs, "sentiment_index")),
            "median_duration_s": stats.median([r["duration_s"] for r in rs]),
            "format_share": {f: sum(1 for r in rs if r["format"] == f) / len(rs) * 100 for f in FORMAT_KEYS},
            "comments": comment_shares(rs),
        }

    kpis = {"prev": period_kpis(prev), "curr": period_kpis(curr)}

    overall = {
        "engagement": compare_medians(_vals(prev, "engagement_ratio"), _vals(curr, "engagement_ratio"), rng),
        "like_rate": compare_medians(_vals(prev, "like_rate"), _vals(curr, "like_rate"), rng),
        "comment_rate": compare_medians(_vals(prev, "comment_rate"), _vals(curr, "comment_rate"), rng),
        "sentiment": compare_medians(_vals(prev, "sentiment_index"), _vals(curr, "sentiment_index"), rng),
        "duration": compare_medians([r["duration_s"] for r in prev], [r["duration_s"] for r in curr], rng),
    }
    pvals |= {k: v["p_value"] for k, v in overall.items()}

    cp, cc = kpis["prev"]["comments"], kpis["curr"]["comments"]
    comment_tests: dict[str, Any] = {
        "negative_p": stats.two_proportion_z(cp["negative"], cp["n"], cc["negative"], cc["n"]),
        "positive_p": stats.two_proportion_z(cp["positive"], cp["n"], cc["positive"], cc["n"]),
    }
    pvals |= {"comments_negative": comment_tests["negative_p"], "comments_positive": comment_tests["positive_p"]}

    # --- Sesgo de antiguedad ---------------------------------------------------------------
    age_bias = {
        "median_age_days": [kpis["prev"]["median_age_days"], kpis["curr"]["median_age_days"]],
        "raw_views_change_pct": stats.pct_change(kpis["curr"]["median_views"], kpis["prev"]["median_views"]),
        "velocity_change_pct": stats.pct_change(kpis["curr"]["median_daily_velocity"],
                                                kpis["prev"]["median_daily_velocity"]),
        "rho_age_velocity_curr": stats.spearman(
            [r["age_days"] for r in curr if r["daily_velocity"] is not None], _vals(curr, "daily_velocity")),
    }

    # --- Robustez: ¿el engagement ratio depende de la edad? -------------------------------
    curr_eng = [r for r in curr if r["engagement_ratio"] is not None and r["mature"]]
    old_curr = [r["engagement_ratio"] for r in curr_eng if r["age_days"] >= 120]
    robustness = {
        "rho_age_engagement_curr_mature": stats.spearman([r["age_days"] for r in curr_eng],
                                                         [r["engagement_ratio"] for r in curr_eng]),
        "rho_age_engagement_prev": stats.spearman(
            [r["age_days"] for r in prev if r["engagement_ratio"] is not None], _vals(prev, "engagement_ratio")),
        "engagement_change_all_pct": overall["engagement"]["change_pct"],
        "engagement_change_curr_aged_120d_pct": stats.pct_change(
            stats.median(old_curr), stats.median(_vals(prev, "engagement_ratio"))),
        "n_curr_aged_120d": len(old_curr),
    }

    # --- Formato ---------------------------------------------------------------------------
    formats = []
    for key in FORMAT_KEYS:
        fp = _by(prev, lambda r, k=key: r["format"] == k)
        fc = _by(curr, lambda r, k=key: r["format"] == k)
        cmp_ = compare_medians(_vals(fp, "engagement_ratio"), _vals(fc, "engagement_ratio"), rng)
        pvals[f"format_{key}"] = cmp_["p_value"]
        pvals[f"format_share_{key}"] = stats.two_proportion_z(len(fp), len(prev), len(fc), len(curr))
        formats.append({
            "key": key, "label": FORMAT_LABELS[key],
            "n_prev": len(fp), "n_curr": len(fc),
            "share_prev": len(fp) / len(prev) * 100, "share_curr": len(fc) / len(curr) * 100,
            "share_p_value": pvals[f"format_share_{key}"],
            "engagement": cmp_,
            "median_velocity_prev": stats.median(_vals(fp, "daily_velocity")),
            "median_velocity_curr": stats.median(_vals(fc, "daily_velocity")),
            "median_rvi_prev": stats.median(_vals(fp, "rvi")),
            "median_rvi_curr": stats.median(_vals(fc, "rvi")),
            "mean_sentiment_prev": stats.mean(_vals(fp, "sentiment_index")),
            "mean_sentiment_curr": stats.mean(_vals(fc, "sentiment_index")),
        })

    duration_bins = []
    for i, (label, _lo, _hi) in enumerate(DURATION_BINS):
        bp = _by(prev, lambda r, i=i: r["duration_bin"] == i)
        bc = _by(curr, lambda r, i=i: r["duration_bin"] == i)
        duration_bins.append({
            "label": label, "n_prev": len(bp), "n_curr": len(bc),
            "median_engagement_prev": stats.median(_vals(bp, "engagement_ratio")),
            "median_engagement_curr": stats.median(_vals(bc, "engagement_ratio")),
            "median_velocity_prev": stats.median(_vals(bp, "daily_velocity")),
            "median_velocity_curr": stats.median(_vals(bc, "daily_velocity")),
            "median_rvi_all": stats.median(_vals(bp + bc, "rvi")),
            "n_rvi_all": len(_vals(bp + bc, "rvi")),
        })

    # --- Subtopicos -----------------------------------------------------------------------
    categories = []
    for key in CATEGORY_KEYS:
        cp_ = _by(prev, lambda r, k=key: r["category"] == k)
        cc_ = _by(curr, lambda r, k=key: r["category"] == k)
        sp, sc = comment_shares(cp_), comment_shares(cc_)
        share_p = stats.two_proportion_z(len(cp_), len(prev), len(cc_), len(curr))
        neg_p = stats.two_proportion_z(sp["negative"], sp["n"], sc["negative"], sc["n"])
        if key != "other":
            pvals[f"share_{key}"] = share_p
            pvals[f"negative_{key}"] = neg_p
        categories.append({
            "key": key, "label": CATEGORY_LABELS[key],
            "n_prev": len(cp_), "n_curr": len(cc_),
            "share_prev": len(cp_) / len(prev) * 100, "share_curr": len(cc_) / len(curr) * 100,
            "share_p_value": share_p,
            "median_engagement_prev": stats.median(_vals(cp_, "engagement_ratio")),
            "median_engagement_curr": stats.median(_vals(cc_, "engagement_ratio")),
            "median_rvi_prev": stats.median(_vals(cp_, "rvi")),
            "median_rvi_curr": stats.median(_vals(cc_, "rvi")),
            "mean_sentiment_prev": stats.mean(_vals(cp_, "sentiment_index")),
            "mean_sentiment_curr": stats.mean(_vals(cc_, "sentiment_index")),
            "negative_share_prev": sp["negative_pct"], "negative_share_curr": sc["negative_pct"],
            "positive_share_prev": sp["positive_pct"], "positive_share_curr": sc["positive_pct"],
            "negative_p_value": neg_p,
            "comments_scored_prev": sp["n"], "comments_scored_curr": sc["n"],
        })

    # --- Correlaciones (Spearman) ---------------------------------------------------------
    def rho(rs: list[Record], a: str, b: str) -> dict[str, Any]:
        pairs = [(r[a], r[b]) for r in rs if r[a] is not None and r[b] is not None]
        return {"rho": stats.spearman([p[0] for p in pairs], [p[1] for p in pairs]), "n": len(pairs)}

    correlation_specs = [
        ("sentiment_index", "engagement_ratio", "Comment sentiment × engagement ratio"),
        ("sentiment_index", "rvi", "Comment sentiment × relative velocity"),
        ("duration_s", "engagement_ratio", "Duration × engagement ratio"),
        ("duration_s", "rvi", "Duration × relative velocity"),
        ("subscriber_count", "rvi", "Channel subscribers × relative velocity"),
        ("subscriber_count", "engagement_ratio", "Channel subscribers × engagement ratio"),
        ("like_rate", "comment_rate", "Like rate × comment rate"),
    ]
    correlations = [
        {"x": a, "y": b, "label": label, "prev": rho(prev, a, b), "curr": rho(curr, a, b), "all": rho(records, a, b)}
        for a, b, label in correlation_specs
    ]

    # --- Terminos y citas -----------------------------------------------------------------
    terms_titles = nlp.emerging_terms([r["title"] for r in prev], [r["title"] for r in curr], min_count=6)
    # Unidad = video (todos sus comentarios juntos): un solo video con 20 comentarios sobre
    # lo mismo no debe dominar el ranking de terminos.
    terms_comments = nlp.emerging_terms(
        [" ".join(c["text"] for c in r["_scored_comments"]) for r in prev if r["_scored_comments"]],
        [" ".join(c["text"] for c in r["_scored_comments"]) for r in curr if r["_scored_comments"]],
        min_count=10)

    quotes: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for pkey, rs in (("prev", prev), ("curr", curr)):
        pool = [c for r in rs for c in r["_scored_comments"]]
        quotes[pkey] = {
            "positive": nlp.pick_quotes([c for c in pool if c["compound"] > 0], k=2),
            "negative": nlp.pick_quotes([c for c in pool if c["compound"] < 0], k=2),
        }

    # --- Comentarios promocionales (astroturfing) ----------------------------------------
    def promo_stats(rs: list[Record]) -> dict[str, Any]:
        fetched = sum(r["promo_comments"] + r["comments_scored"] for r in rs)  # base aproximada: ingles + promo
        return {
            "comments": sum(r["promo_comments"] for r in rs),
            "videos": sum(1 for r in rs if r["promo_comments"]),
            "video_share": sum(1 for r in rs if r["promo_comments"]) / len(rs) * 100,
            "comment_share": sum(r["promo_comments"] for r in rs) / fetched * 100 if fetched else math.nan,
            "by_brand": {b: sum(1 for r in rs if b in r["promo_brands"]) for b in PROMO_BRANDS},
            "by_category": {k: sum(1 for r in rs if r["promo_comments"] and r["category"] == k) for k in CATEGORY_KEYS},
        }

    promo = {"prev": promo_stats(prev), "curr": promo_stats(curr), "brands": list(PROMO_BRANDS)}
    promo["video_share_p_value"] = stats.two_proportion_z(promo["prev"]["videos"], len(prev),
                                                          promo["curr"]["videos"], len(curr))
    pvals["promo_videos"] = promo["video_share_p_value"]

    # --- Multiplicidad: Benjamini-Hochberg sobre toda la familia ---------------------------
    qvals = stats.benjamini_hochberg(pvals)
    for name, cmp_ in overall.items():
        cmp_["q_value"] = qvals.get(name)
    for f in formats:
        f["engagement"]["q_value"] = qvals.get(f"format_{f['key']}")
        f["share_q_value"] = qvals.get(f"format_share_{f['key']}")
    for c in categories:
        c["share_q_value"] = qvals.get(f"share_{c['key']}")
        c["negative_q_value"] = qvals.get(f"negative_{c['key']}")
    promo["video_share_q_value"] = qvals.get("promo_videos")
    comment_tests["negative_q"] = qvals.get("comments_negative")
    comment_tests["positive_q"] = qvals.get("comments_positive")

    summary: dict[str, Any] = {
        "meta": {
            "topic": TOPIC,
            "data_source": "youtube_data_api_v3",
            "fetched_at": payload["fetched_at"],
            "snapshot": snapshot.isoformat(),
            "periods": [{"key": p.key, "label": p.label, "start": p.start.isoformat(),
                         "end": p.end.isoformat()} for p in PERIODS],
            "queries": payload.get("queries", []),
            "results_per_query_month": payload.get("results_per_query_month"),
            "generated_at": datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z"),
        },
        "audit": audit,
        "kpis": kpis,
        "overall": overall,
        "comment_tests": comment_tests,
        "age_bias": age_bias,
        "robustness": robustness,
        "formats": formats,
        "duration_bins": duration_bins,
        "categories": categories,
        "correlations": correlations,
        "emerging_terms": {"titles": terms_titles, "comments": terms_comments},
        "quotes": quotes,
        "promotional_comments": promo,
        "tests_in_family": len(qvals),
        "thresholds": {"maturity_days": MATURITY_DAYS, "age_band_days": AGE_BAND_DAYS,
                       "min_views": MIN_VIEWS, "min_group_n": MIN_GROUP_N,
                       "min_comments_for_sentiment": MIN_COMMENTS_FOR_SENTIMENT,
                       "negative_threshold": NEGATIVE_THRESHOLD, "positive_threshold": POSITIVE_THRESHOLD,
                       "bootstrap_resamples": BOOTSTRAP_RESAMPLES, "alpha": ALPHA},
    }
    summary["highlights"] = narrative.typeset(narrative.build_highlights(summary))
    summary["recommendations"] = narrative.typeset(narrative.build_recommendations(summary))
    return summary


# =============================================================================
# 4. Exportacion
# =============================================================================
def _clean(obj: Any, digits: int = 4) -> Any:
    """NaN -> None y redondeo para JSON estable y ligero."""
    if isinstance(obj, float):
        return None if math.isnan(obj) or math.isinf(obj) else round(obj, digits)
    if isinstance(obj, dict):
        return {k: _clean(v, digits) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v, digits) for v in obj]
    return obj


def _write(path: Path, data: Any, indent: int | None = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=indent,
                      separators=None if indent else (",", ":"))
    path.write_text(text + "\n", encoding="utf-8")
    print(f"  -> {path.relative_to(REPO)}  ({path.stat().st_size / 1024:.0f} KB)")


def export(records: list[Record], summary: dict[str, Any], rvi_edges: list[float]) -> None:
    print("[4/5] Exportando...")
    summary = _clean(summary)
    public_records = [{k: v for k, v in r.items() if not k.startswith("_")} for r in records]
    _write(PROCESSED_DIR / "youtube_insights.json",
           {"summary": summary, "videos": _clean(public_records, 3)}, indent=None)
    _write(WEB_SERVER_DIR / "insights_summary.json", summary)

    def num(x: float | None, d: int) -> float | None:
        return None if x is None else round(x, d)

    rows = [[
        0 if r["period"] == "prev" else 1,
        r["month"],
        CATEGORY_KEYS.index(r["category"]),
        FORMAT_KEYS.index(r["format"]),
        r["duration_s"],
        r["views"],
        num(r["daily_velocity"], 1),
        num(r["engagement_ratio"], 3),
        num(r["sentiment_index"], 1),
        r["rvi_quintile"],
        r["age_days"],
        r["positive_comments"],
        r["neutral_comments"],
        r["negative_comments"],
    ] for r in records]
    _write(WEB_PUBLIC_DIR / "videos.json", {
        "fields": ["period", "month", "category", "format", "durationS", "views", "dailyVelocity",
                   "engagementRatio", "sentimentIndex", "rviQuintile", "ageDays",
                   "positiveComments", "neutralComments", "negativeComments"],
        "categories": [{"key": k, "label": CATEGORY_LABELS[k]} for k in CATEGORY_KEYS],
        "formats": [{"key": k, "label": FORMAT_LABELS[k]} for k in FORMAT_KEYS],
        "durationBins": [{"label": b[0], "min": b[1], "max": None if math.isinf(b[2]) else b[2]}
                         for b in DURATION_BINS],
        "sentimentBuckets": [b[0] for b in SENTIMENT_BUCKETS],
        "rviQuintileEdges": [round(e, 3) for e in rvi_edges],
        "rows": rows,
    }, indent=None)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--refresh", action="store_true", help="vuelve a descargar de la API (gasta cuota)")
    args = parser.parse_args()

    payload = load_raw(args.refresh)
    records, audit, rvi_edges, snapshot = build_features(payload)
    summary = analyze(records, audit, snapshot, payload)
    export(records, summary, rvi_edges)
    print("[5/5] Listo.")
    for h in summary["highlights"]:
        print(f"  · {h['headline']}")


if __name__ == "__main__":
    main()
