"""
extract_and_process.py
Pipeline completo: ingesta -> limpieza -> features -> NLP -> estadistica -> exportacion.

Uso (desde cualquier directorio):
  python analytics/youtube-topic-intelligence/scripts/extract_and_process.py               # auto
  python .../extract_and_process.py --source synthetic
  YOUTUBE_API_KEY=... python .../extract_and_process.py --source api [--refresh]

Salidas:
  analytics/youtube-topic-intelligence/data/processed/youtube_insights.json  registros + resumen
  data/youtube-topic-intelligence/insights_summary.json                      case study (fs, servidor)
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
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import nlp
import stats
import synthetic
import youtube_api
from config import (
    AGE_BAND_DAYS, BOOTSTRAP_RESAMPLES, CATEGORIES, CRITICAL_THRESHOLD, DURATION_BINS,
    FORMATS, MATURITY_DAYS, MIN_VIEWS, OTHER_CATEGORY, PERIODS, POSITIVE_THRESHOLD,
    PROCESSED_DIR, RAW_DIR, REPO, SEARCH_QUERIES, SEED, SENTIMENT_BUCKETS, SNAPSHOT, TOPIC,
    WEB_PUBLIC_DIR, WEB_SERVER_DIR,
)

Record = dict[str, Any]
CATEGORY_KEYS = [c[0] for c in CATEGORIES] + [OTHER_CATEGORY[0]]
CATEGORY_LABELS = {c[0]: c[1] for c in CATEGORIES} | {OTHER_CATEGORY[0]: OTHER_CATEGORY[1]}
FORMAT_KEYS = [f[0] for f in FORMATS]
FORMAT_LABELS = {f[0]: f[1] for f in FORMATS}


# =============================================================================
# 1. Ingesta
# =============================================================================
def load_raw(source: str, refresh: bool) -> tuple[list[Record], str]:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    key = os.environ.get("YOUTUBE_API_KEY", "")
    if source == "auto":
        source = "api" if key else "synthetic"

    if source == "synthetic":
        print("[1/5] Generando dataset sintetico (seed=%d)..." % SEED)
        raw = synthetic.generate(SEED)
        (RAW_DIR / "synthetic_videos.json").write_text(json.dumps(raw), encoding="utf-8")
        return raw, "synthetic"

    if not key:
        raise SystemExit("--source api requiere la variable de entorno YOUTUBE_API_KEY")
    cache = RAW_DIR / f"youtube_api_{SNAPSHOT.isoformat()}.json"
    if cache.exists() and not refresh:
        print(f"[1/5] Usando cache de la API: {cache.relative_to(REPO)}")
        payload = json.loads(cache.read_text(encoding="utf-8"))
    else:
        print("[1/5] Descargando de YouTube Data API v3...")
        payload = youtube_api.fetch(key)
        cache.write_text(json.dumps(payload), encoding="utf-8")
    return youtube_api.normalize(payload), "youtube_data_api_v3"


# =============================================================================
# 2. Limpieza + features
# =============================================================================
def _period_of(d: date) -> str | None:
    for p in PERIODS:
        if p.start <= d <= p.end:
            return p.key
    return None


def _bucket(value: float, edges: Iterable[tuple[str, float, float]]) -> int:
    for i, (_label, lo, hi) in enumerate(edges):
        if lo <= value < hi:
            return i
    return -1


def _duration_bin(duration_s: float) -> int:
    """Intervalos (lo, hi], igual que los formatos: 180 s es Short y cae en '1–3m'."""
    for i, (_label, lo, hi) in enumerate(DURATION_BINS):
        if lo < duration_s <= hi:
            return i
    return -1


def _format_of(duration_s: float) -> str:
    for key, _label, lo, hi in FORMATS:
        if lo < duration_s <= hi:
            return key
    return FORMAT_KEYS[-1]


def build_features(raw: list[Record]) -> tuple[list[Record], dict[str, int], list[float]]:
    print("[2/5] Limpieza, features y NLP...")
    audit = defaultdict(int)
    audit["raw_records"] = len(raw)
    seen: set[str] = set()
    records: list[Record] = []

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
        if v["duration_s"] <= 0:
            audit["dropped_no_duration"] += 1   # directos/estrenos sin duracion
            continue

        age = max((SNAPSHOT - published).days, 1)
        views = v["views"]
        mature = age >= MATURITY_DAYS
        audit["immature_excluded_from_velocity"] += 0 if mature else 1

        eer = None
        if v["likes"] is None or v["comments"] is None:
            audit["eer_missing_hidden_counts"] += 1
        elif views < MIN_VIEWS:
            audit["eer_excluded_low_views"] += 1
        else:
            eer = (v["likes"] + v["comments"]) / views * 100

        scores = [nlp.score_sentiment(t) for t in v["comment_texts"]]
        audit["comments_scored"] += len(scores)
        sentiment = stats.mean(scores) * 100 if scores else None

        category = nlp.classify_category(v["title"], v["tags"])
        records.append({
            "video_id": v["video_id"],
            "title": v["title"],
            "channel_id": v["channel_id"],
            "period": period,
            "published": published.isoformat(),
            "month": published.month,
            "age_days": age,
            "duration_s": v["duration_s"],
            "format": _format_of(v["duration_s"]),
            "duration_bin": _duration_bin(v["duration_s"]),
            "category": category,
            "truth_category": v.get("truth_category"),
            "views": views,
            "likes": v["likes"],
            "comments": v["comments"],
            "mature": mature,
            "daily_velocity": views / age if mature else None,
            "eer": eer,
            "sentiment_index": sentiment,
            "sentiment_bucket": _bucket(sentiment, SENTIMENT_BUCKETS) if sentiment is not None else -1,
            "n_comments_scored": len(scores),
            "critical_comments": sum(1 for s in scores if s <= CRITICAL_THRESHOLD),
            "positive_comments": sum(1 for s in scores if s >= POSITIVE_THRESHOLD),
        })

    rvi_edges = _add_relative_velocity(records)
    audit["analyzed_records"] = len(records)
    return records, dict(audit), rvi_edges


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


def _by(records: list[Record], *preds: Callable[[Record], bool]) -> list[Record]:
    return [r for r in records if all(p(r) for p in preds)]


def compare_medians(prev: list[float], curr: list[float], rng: random.Random) -> dict[str, Any]:
    mp, mc = stats.median(prev), stats.median(curr)
    lo, hi = stats.bootstrap_median_change(prev, curr, BOOTSTRAP_RESAMPLES, rng)
    _u, p = stats.mann_whitney_u(prev, curr)
    return {
        "n_prev": len(prev), "n_curr": len(curr),
        "median_prev": mp, "median_curr": mc,
        "change_pct": stats.pct_change(mc, mp),
        "ci95": [lo, hi],
        "p_value": p,
        "cliffs_delta": stats.cliffs_delta(prev, curr),
    }


def analyze(records: list[Record], audit: dict[str, int], source: str) -> dict[str, Any]:
    print("[3/5] Analisis estadistico (bootstrap x%d)..." % BOOTSTRAP_RESAMPLES)
    rng = random.Random(SEED)
    is_prev = lambda r: r["period"] == "prev"  # noqa: E731
    is_curr = lambda r: r["period"] == "curr"  # noqa: E731
    prev, curr = _by(records, is_prev), _by(records, is_curr)

    def period_kpis(rs: list[Record]) -> dict[str, Any]:
        n_sc = sum(r["n_comments_scored"] for r in rs)
        return {
            "videos": len(rs),
            "median_age_days": stats.median([r["age_days"] for r in rs]),
            "median_views": stats.median([r["views"] for r in rs]),
            "median_daily_velocity": stats.median(_vals(rs, "daily_velocity")),
            "median_eer": stats.median(_vals(rs, "eer")),
            "mean_sentiment_index": stats.mean(_vals(rs, "sentiment_index")),
            "critical_comment_share": sum(r["critical_comments"] for r in rs) / n_sc * 100 if n_sc else None,
            "shorts_share": sum(1 for r in rs if r["format"] == "short") / len(rs) * 100,
        }

    kpis = {"prev": period_kpis(prev), "curr": period_kpis(curr)}
    supply_growth = stats.pct_change(len(curr), len(prev))
    eer_overall = compare_medians(_vals(prev, "eer"), _vals(curr, "eer"), rng)

    # --- Sesgo de antiguedad: las metricas crudas se mueven en direcciones opuestas -------
    age_bias = {
        "median_age_days": [kpis["prev"]["median_age_days"], kpis["curr"]["median_age_days"]],
        "raw_views_change_pct": stats.pct_change(kpis["curr"]["median_views"], kpis["prev"]["median_views"]),
        "velocity_change_pct": stats.pct_change(kpis["curr"]["median_daily_velocity"],
                                                kpis["prev"]["median_daily_velocity"]),
        "rho_age_velocity_curr": stats.spearman(
            [r["age_days"] for r in curr if r["daily_velocity"] is not None], _vals(curr, "daily_velocity")),
    }

    # --- Robustez: ¿el EER depende de la edad? -------------------------------------------
    curr_eer_rows = [r for r in curr if r["eer"] is not None and r["mature"]]
    old_curr = [r["eer"] for r in curr_eer_rows if r["age_days"] >= 120]
    robustness = {
        "rho_age_eer_curr_mature": stats.spearman([r["age_days"] for r in curr_eer_rows],
                                                  [r["eer"] for r in curr_eer_rows]),
        "rho_age_eer_prev": stats.spearman([r["age_days"] for r in prev if r["eer"] is not None],
                                           _vals(prev, "eer")),
        "eer_change_all_curr_pct": stats.pct_change(stats.median(_vals(curr, "eer")),
                                                    stats.median(_vals(prev, "eer"))),
        "eer_change_curr_aged_120d_pct": stats.pct_change(stats.median(old_curr),
                                                          stats.median(_vals(prev, "eer"))),
        "n_curr_aged_120d": len(old_curr),
    }

    # --- Formato ---------------------------------------------------------------------------
    formats = []
    for key in FORMAT_KEYS:
        fp = _by(prev, lambda r, k=key: r["format"] == k)
        fc = _by(curr, lambda r, k=key: r["format"] == k)
        formats.append({
            "key": key, "label": FORMAT_LABELS[key],
            "share_prev": len(fp) / len(prev) * 100, "share_curr": len(fc) / len(curr) * 100,
            "eer": compare_medians(_vals(fp, "eer"), _vals(fc, "eer"), rng),
            "median_rvi_prev": stats.median(_vals(fp, "rvi")),
            "median_rvi_curr": stats.median(_vals(fc, "rvi")),
        })

    duration_bins = []
    for i, (label, _lo, _hi) in enumerate(DURATION_BINS):
        bp = _vals(_by(prev, lambda r, i=i: r["duration_bin"] == i), "eer")
        bc = _vals(_by(curr, lambda r, i=i: r["duration_bin"] == i), "eer")
        duration_bins.append({"label": label, "n_prev": len(bp), "n_curr": len(bc),
                              "median_eer_prev": stats.median(bp), "median_eer_curr": stats.median(bc)})

    # --- Subtopicos: cuota de oferta, engagement y polarizacion ---------------------------
    categories = []
    for key in CATEGORY_KEYS:
        cp = _by(prev, lambda r, k=key: r["category"] == k)
        cc = _by(curr, lambda r, k=key: r["category"] == k)
        crit_p, n_p = sum(r["critical_comments"] for r in cp), sum(r["n_comments_scored"] for r in cp)
        crit_c, n_c = sum(r["critical_comments"] for r in cc), sum(r["n_comments_scored"] for r in cc)
        pos_p, pos_c = sum(r["positive_comments"] for r in cp), sum(r["positive_comments"] for r in cc)
        categories.append({
            "key": key, "label": CATEGORY_LABELS[key],
            "n_prev": len(cp), "n_curr": len(cc),
            "share_prev": len(cp) / len(prev) * 100, "share_curr": len(cc) / len(curr) * 100,
            "share_p_value": stats.two_proportion_z(len(cp), len(prev), len(cc), len(curr)),
            "median_eer_prev": stats.median(_vals(cp, "eer")), "median_eer_curr": stats.median(_vals(cc, "eer")),
            "median_rvi_curr": stats.median(_vals(cc, "rvi")),
            "mean_sentiment_prev": stats.mean(_vals(cp, "sentiment_index")),
            "mean_sentiment_curr": stats.mean(_vals(cc, "sentiment_index")),
            "critical_share_prev": crit_p / n_p * 100 if n_p else None,
            "critical_share_curr": crit_c / n_c * 100 if n_c else None,
            "positive_share_prev": pos_p / n_p * 100 if n_p else None,
            "positive_share_curr": pos_c / n_c * 100 if n_c else None,
            "critical_p_value": stats.two_proportion_z(crit_p, n_p, crit_c, n_c),
            "comments_scored_prev": n_p, "comments_scored_curr": n_c,
        })

    # --- Sentimiento vs rendimiento -------------------------------------------------------
    def rho(rs: list[Record], a: str, b: str) -> float:
        pairs = [(r[a], r[b]) for r in rs if r[a] is not None and r[b] is not None]
        return stats.spearman([p[0] for p in pairs], [p[1] for p in pairs])

    sentiment_performance = {
        p: {"rho_sentiment_eer": rho(rs, "sentiment_index", "eer"),
            "rho_sentiment_rvi": rho(rs, "sentiment_index", "rvi")}
        for p, rs in (("prev", prev), ("curr", curr))
    }

    terms = nlp.emerging_terms([r["title"] for r in prev], [r["title"] for r in curr])

    classifier_qa = None
    if any(r["truth_category"] for r in records):
        hits = sum(1 for r in records if r["category"] == r["truth_category"])
        classifier_qa = {
            "accuracy": hits / len(records) * 100,
            "other_rate": sum(1 for r in records if r["category"] == "other") / len(records) * 100,
        }

    summary = {
        "meta": {
            "topic": TOPIC,
            "data_source": source,
            "is_synthetic": source == "synthetic",
            "snapshot": SNAPSHOT.isoformat(),
            "periods": [{"key": p.key, "label": p.label, "start": p.start.isoformat(),
                         "end": p.end.isoformat()} for p in PERIODS],
            "queries": list(SEARCH_QUERIES),
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "seed": SEED,
        },
        "audit": audit,
        "kpis": kpis,
        "supply_growth_pct": supply_growth,
        "eer_overall": eer_overall,
        "age_bias": age_bias,
        "robustness": robustness,
        "formats": formats,
        "duration_bins": duration_bins,
        "categories": categories,
        "sentiment_performance": sentiment_performance,
        "emerging_terms": terms,
        "classifier_qa": classifier_qa,
        "thresholds": {"maturity_days": MATURITY_DAYS, "age_band_days": AGE_BAND_DAYS,
                       "min_views": MIN_VIEWS, "critical_threshold": CRITICAL_THRESHOLD,
                       "bootstrap_resamples": BOOTSTRAP_RESAMPLES},
    }
    summary["highlights"] = _typeset(build_highlights(summary))
    summary["recommendations"] = _typeset(build_recommendations(summary))
    return summary


# =============================================================================
# 4. Narrativa derivada de los datos (nunca hardcodeada)
# =============================================================================
def _sig(p: float) -> str:
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def _signed(x: float, digits: int = 0) -> str:
    return f"{x:+.{digits}f}"


_MINUS = re.compile(r"(?<=[\s\[(])-(?=\d)")


def _typeset(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Signo menos tipografico (U+2212) en la narrativa, igual que en la UI."""
    return [{k: _MINUS.sub("\u2212", v) if isinstance(v, str) else v for k, v in it.items()} for it in items]


def build_highlights(s: dict[str, Any]) -> list[dict[str, Any]]:
    fm = {f["key"]: f for f in s["formats"]}
    short, mid = fm["short"]["eer"], fm["mid"]["eer"]

    cats = [c for c in s["categories"] if c["key"] != "other" and c["critical_share_prev"] is not None]
    polar = max(cats, key=lambda c: c["critical_share_curr"] - c["critical_share_prev"])
    pp = polar["critical_share_curr"] - polar["critical_share_prev"]
    rel = stats.pct_change(polar["critical_share_curr"], polar["critical_share_prev"])

    k = s["kpis"]
    eer_all = s["eer_overall"]

    return [
        {
            "id": "format-shift",
            "kicker": "Format shift",
            "headline": (f"Mid-length engagement efficiency {_signed(mid['change_pct'])}% YoY "
                         f"while Short-form moved {_signed(short['change_pct'])}%"),
            "detail": (f"Median EER for 3–20 min videos went from {mid['median_prev']:.2f}% to "
                       f"{mid['median_curr']:.2f}%; Shorts went from {short['median_prev']:.2f}% to "
                       f"{short['median_curr']:.2f}% even as their share of uploads rose from "
                       f"{fm['short']['share_prev']:.0f}% to {fm['short']['share_curr']:.0f}%."),
            "evidence": (f"Mid 95% CI [{mid['ci95'][0]:+.0f}%, {mid['ci95'][1]:+.0f}%] · {_sig(mid['p_value'])} · "
                         f"Shorts 95% CI [{short['ci95'][0]:+.0f}%, {short['ci95'][1]:+.0f}%] · {_sig(short['p_value'])}"),
            "unit": "% EER",
            "bars": [
                {"label": "Short-form", "prev": short["median_prev"], "curr": short["median_curr"]},
                {"label": "Mid-length", "prev": mid["median_prev"], "curr": mid["median_curr"]},
            ],
        },
        {
            "id": "polarization",
            "kicker": "Audience polarization",
            "headline": (f"Critical comments in {polar['label']} rose {_signed(rel)}% "
                         f"({_signed(pp, 1)} pp)"),
            "detail": (f"{polar['critical_share_prev']:.1f}% of scored comments were critical in the prior "
                       f"period vs {polar['critical_share_curr']:.1f}% now, across "
                       f"{polar['comments_scored_curr']:,} comments this year. Positive share moved from "
                       f"{polar['positive_share_prev']:.1f}% to {polar['positive_share_curr']:.1f}%."),
            "evidence": f"Two-proportion z-test · {_sig(polar['critical_p_value'])}",
            "unit": "% critical",
            "bars": [{"label": polar["label"], "prev": polar["critical_share_prev"],
                      "curr": polar["critical_share_curr"]}],
        },
        {
            "id": "saturation",
            "kicker": "Supply surge, flat engagement",
            "headline": (f"Uploads {_signed(s['supply_growth_pct'])}% YoY, while overall engagement "
                         f"efficiency stayed flat ({_signed(eer_all['change_pct'])}%)"),
            "detail": (f"{k['curr']['videos']:,} videos this year vs {k['prev']['videos']:,} in the same "
                       f"window last year. The flat topline hides opposing moves: Short-form EER moved "
                       f"{_signed(fm['short']['eer']['change_pct'])}% and Shorts now make up "
                       f"{k['curr']['shorts_share']:.0f}% of uploads (was {k['prev']['shorts_share']:.0f}%), "
                       f"cancelling the {_signed(fm['mid']['eer']['change_pct'])}% gain in mid-length content."),
            "evidence": (f"Overall EER 95% CI [{eer_all['ci95'][0]:+.0f}%, {eer_all['ci95'][1]:+.0f}%] · "
                         f"{_sig(eer_all['p_value'])} · videos ≥120 days old: "
                         f"{_signed(s['robustness']['eer_change_curr_aged_120d_pct'])}% "
                         f"(n = {s['robustness']['n_curr_aged_120d']})"),
            "unit": "videos",
            "bars": [{"label": "Uploads", "prev": k["prev"]["videos"], "curr": k["curr"]["videos"]}],
        },
    ]


def build_recommendations(s: dict[str, Any]) -> list[dict[str, str]]:
    fm = {f["key"]: f for f in s["formats"]}
    cats = [c for c in s["categories"] if c["key"] != "other"]
    gainer = max(cats, key=lambda c: c["share_curr"] - c["share_prev"])
    loser = min(cats, key=lambda c: c["share_curr"] - c["share_prev"])
    bins = [b for b in s["duration_bins"] if b["n_curr"] >= 30]
    best_bin = max(bins, key=lambda b: b["median_eer_curr"])
    polar = max((c for c in cats if c["critical_share_prev"] is not None),
                key=lambda c: c["critical_share_curr"] - c["critical_share_prev"])
    rising = ", ".join(f"“{t['term']}”" for t in s["emerging_terms"]["rising"][:3])

    recs = [
        {
            "audience": "Creators",
            "title": f"Anchor production on {best_bin['label']} explainers",
            "body": (f"The {best_bin['label']} band has the highest median EER this year "
                     f"({best_bin['median_eer_curr']:.2f}%, n = {best_bin['n_curr']}). Use Shorts as a "
                     f"discovery funnel into those videos rather than as the primary engagement vehicle."),
        },
        {
            "audience": "Creators",
            "title": f"Ride the {gainer['label']} wave — but differentiate",
            "body": (f"{gainer['label']} grew from {gainer['share_prev']:.0f}% to {gainer['share_curr']:.0f}% "
                     f"of uploads. Its median within-period Relative Velocity Index is "
                     f"{gainer['median_rvi_curr']:.2f}× (1.00× = typical video of the same age), so demand is "
                     f"{'still keeping pace' if gainer['median_rvi_curr'] >= 1 else 'not keeping pace'} with supply. "
                     f"Rising title terms: {rising}."),
        },
        {
            "audience": "Brands",
            "title": f"Apply brand-safety review to {polar['label']} placements",
            "body": (f"Critical-comment share in {polar['label']} is {polar['critical_share_curr']:.0f}% "
                     f"(was {polar['critical_share_prev']:.0f}%). Polarized comment sections raise "
                     f"comment volume but weaken the like signal; pair sponsorships there with "
                     f"comment-moderation commitments, or shift budget to lower-friction subtopics."),
        },
        {
            "audience": "Brands",
            "title": "Buy on efficiency, not on reach",
            "body": (f"Shorts rose to {fm['short']['share_curr']:.0f}% of supply while their median EER "
                     f"moved {fm['short']['eer']['change_pct']:+.0f}%. Negotiate integrations on "
                     f"engagement-efficiency benchmarks per format, and treat raw view counts from "
                     f"videos of different ages as non-comparable."),
        },
        {
            "audience": "Brands",
            "title": f"Reallocate away from {loser['label']}",
            "body": (f"{loser['label']} fell from {loser['share_prev']:.0f}% to {loser['share_curr']:.0f}% "
                     f"of uploads ({_sig(loser['share_p_value'])}). Fewer creators and a shorter shelf life "
                     f"make it a weaker vehicle for evergreen sponsorships."),
        },
    ]
    return recs


# =============================================================================
# 5. Exportacion
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
    _write(PROCESSED_DIR / "youtube_insights.json",
           {"summary": summary, "videos": _clean(records, 3)}, indent=None)
    _write(WEB_SERVER_DIR / "insights_summary.json", summary)

    # Filas compactas para filtrar en el cliente. Orden de campos en "fields".
    def num(x: float | None, d: int) -> float | None:
        return None if x is None else round(x, d)

    rows = [[
        0 if r["period"] == "prev" else 1,
        r["month"],
        CATEGORY_KEYS.index(r["category"]),
        FORMAT_KEYS.index(r["format"]),
        r["duration_s"],
        num(r["daily_velocity"], 1),
        num(r["eer"], 3),
        num(r["sentiment_index"], 1),
        r["rvi_quintile"],
        r["age_days"],
    ] for r in records]
    _write(WEB_PUBLIC_DIR / "videos.json", {
        "fields": ["period", "month", "category", "format", "durationS", "dailyVelocity",
                   "eer", "sentimentIndex", "rviQuintile", "ageDays"],
        "categories": [{"key": k, "label": CATEGORY_LABELS[k]} for k in CATEGORY_KEYS],
        "formats": [{"key": k, "label": FORMAT_LABELS[k]} for k in FORMAT_KEYS],
        "durationBins": [{"label": b[0], "min": b[1], "max": None if math.isinf(b[2]) else b[2]}
                         for b in DURATION_BINS],
        "sentimentBuckets": [b[0] for b in SENTIMENT_BUCKETS],
        "rviQuintileEdges": [round(e, 3) for e in rvi_edges],
        "isSynthetic": summary["meta"]["is_synthetic"],
        "rows": rows,
    }, indent=None)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", choices=("auto", "synthetic", "api"), default="auto")
    parser.add_argument("--refresh", action="store_true", help="ignora la cache de la API")
    args = parser.parse_args()

    raw, source = load_raw(args.source, args.refresh)
    records, audit, rvi_edges = build_features(raw)
    summary = analyze(records, audit, source)
    export(records, summary, rvi_edges)
    print("[5/5] Listo.")
    for h in summary["highlights"]:
        print(f"  · {h['headline']}")


if __name__ == "__main__":
    main()
