"""
narrative.py
Titulares, evidencia y recomendaciones derivados del resumen estadistico. Toda afirmacion
depende de su q-value (Benjamini-Hochberg): lo no significativo se redacta como "plano" o
"indicio", nunca como hallazgo. Si los datos cambian, el texto cambia.
"""

from __future__ import annotations

import re
from typing import Any

from config import ALPHA

_MINUS = re.compile(r"(?<=[\s\[(])-(?=\d)")


def typeset(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Signo menos tipografico (U+2212) en la narrativa, igual que en la UI."""
    return [{k: _MINUS.sub("−", v) if isinstance(v, str) else v for k, v in it.items()} for it in items]


def _signed(x: float | None, digits: int = 0) -> str:
    return "n/a" if x is None else f"{x:+.{digits}f}"


def _q(q: float | None) -> str:
    if q is None:
        return "q n/a"
    return "q < 0.001" if q < 0.001 else f"q = {q:.3f}"


def _sig(q: float | None) -> bool:
    return q is not None and q < ALPHA


def _minutes(seconds: float) -> str:
    return f"{seconds / 60:.1f} min"


def _corr(s: dict[str, Any], x: str, y: str) -> dict[str, Any]:
    return next(c for c in s["correlations"] if c["x"] == x and c["y"] == y)


def build_highlights(s: dict[str, Any]) -> list[dict[str, Any]]:
    fm = {f["key"]: f for f in s["formats"]}
    short, mid, long_ = fm["short"], fm["mid"], fm["long"]
    lab_p, lab_c = (p["label"] for p in s["meta"]["periods"])
    dur = s["overall"]["duration"]
    dur_rvi = _corr(s, "duration_s", "rvi")
    dur_eng = _corr(s, "duration_s", "engagement_ratio")
    eng = s["overall"]["engagement"]
    cr = s["overall"]["comment_rate"]
    promo = s["promotional_comments"]
    kp, kc = s["kpis"]["prev"]["comments"], s["kpis"]["curr"]["comments"]
    ct = s["comment_tests"]

    # 1. Cambio de formato en lo que la plataforma muestra
    grew = "rose" if long_["share_curr"] > long_["share_prev"] else "fell"
    h_format = {
        "id": "format-shift",
        "kicker": "Algorithmic format shift",
        "headline": (f"Long-form {grew} from {long_['share_prev']:.0f}% to {long_['share_curr']:.0f}% of the "
                     f"videos YouTube surfaces for the topic; Shorts went from {short['share_prev']:.0f}% "
                     f"to {short['share_curr']:.0f}%"),
        "detail": (f"Median video length moved from {_minutes(dur['median_prev'])} to "
                   f"{_minutes(dur['median_curr'])}. Within {lab_c}, longer videos also earn more reach "
                   f"relative to videos of the same age (Spearman ρ duration × relative velocity = "
                   f"{dur_rvi['curr']['rho']:.2f}, vs {dur_rvi['prev']['rho']:.2f} in {lab_p})."),
        "evidence": (f"Long-form share {_q(long_['share_q_value'])} · Shorts share {_q(short['share_q_value'])} · "
                     f"median length {_q(dur['q_value'])} (Benjamini-Hochberg, {s['tests_in_family']} tests)"),
        "unit": "% of videos",
        "bars": [{"label": f["label"].split(" (")[0], "prev": f["share_prev"], "curr": f["share_curr"]}
                 for f in (short, mid, long_)],
    }

    # 2. Engagement: nivel y donde se movio
    if _sig(eng["q_value"]):
        eng_head = f"Engagement ratio {_signed(eng['change_pct'])}% YoY"
    else:
        eng_head = f"Engagement ratio statistically flat ({_signed(eng['change_pct'])}%)"
    flipped = (dur_eng["prev"]["rho"] or 0) * (dur_eng["curr"]["rho"] or 0) < 0
    h_engagement = {
        "id": "engagement",
        "kicker": "Reach and interaction decoupled" if flipped else "Engagement by format",
        "headline": (f"{eng_head}, driven by Shorts ({_signed(short['engagement']['change_pct'])}%) "
                     f"while long-form moved {_signed(long_['engagement']['change_pct'])}%"),
        "detail": (f"The link between length and engagement {'reversed' if flipped else 'shifted'}: "
                   f"Spearman ρ duration × engagement went from {dur_eng['prev']['rho']:+.2f} to "
                   f"{dur_eng['curr']['rho']:+.2f}. Comment rate moved {_signed(cr['change_pct'])}% "
                   f"({_q(cr['q_value'])}). Long-form now wins reach; short videos win interaction per view."),
        "evidence": (f"Overall 95% CI [{eng['ci95'][0]:+.0f}%, {eng['ci95'][1]:+.0f}%] · {_q(eng['q_value'])} · "
                     f"Shorts n = {short['engagement']['n_curr']} this year, {_q(short['engagement']['q_value'])} · "
                     f"long-form {_q(long_['engagement']['q_value'])}"),
        "unit": "% engagement",
        "bars": [{"label": f["label"].split(" (")[0], "prev": f["engagement"]["median_prev"],
                  "curr": f["engagement"]["median_curr"]} for f in (short, mid, long_)],
    }

    # 3. Integridad de la seccion de comentarios + sentimiento organico
    sent_flat = not _sig(ct["negative_q"])
    h_integrity = {
        "id": "astroturfing",
        "kicker": "Comment-section integrity",
        "headline": (f"{promo['prev']['video_share']:.0f}% of {lab_p} videos carried coordinated brand-promotion "
                     f"comments, vs {promo['curr']['video_share']:.0f}% in {lab_c}"),
        "detail": (f"{promo['prev']['comments'] + promo['curr']['comments']} comments promoting "
                   f"{len(promo['brands'])} products were removed before scoring sentiment. On the remaining "
                   f"organic comments, the negative share went from {kp['negative_pct']:.1f}% to "
                   f"{kc['negative_pct']:.1f}%: {'no significant change' if sent_flat else 'a significant shift'}."),
        "evidence": (f"Videos with promo comments: two-proportion z-test {_q(promo['video_share_q_value'])} · "
                     f"organic negative share {_q(ct['negative_q'])}. Older videos had more time to collect spam."),
        "unit": "% of videos",
        "bars": [{"label": "Videos with promo comments", "prev": promo["prev"]["video_share"],
                  "curr": promo["curr"]["video_share"]}],
    }
    return [h_format, h_engagement, h_integrity]


def _subs_engagement_sentence(c: dict[str, Any]) -> str:
    """Se evalua por ano: el rho agrupado puede cancelar efectos de signo opuesto."""
    p, q = c["prev"]["rho"] or 0, c["curr"]["rho"] or 0
    if max(abs(p), abs(q)) < 0.2:
        return (f"The engagement ratio is barely tied to channel size in either year (ρ = {p:+.2f} / {q:+.2f}), "
                f"so it is the fairer way to compare creators on audience quality.")
    if p * q < 0:
        return (f"The link between channel size and engagement flipped sign (ρ = {p:+.2f} → {q:+.2f}): in "
                f"{'the current window larger channels get less interaction per view' if q < 0 else 'the current window larger channels get more interaction per view'}. "
                f"Compare creators on engagement only within the same subscriber tier.")
    return (f"Engagement also tracks channel size (ρ = {p:+.2f} → {q:+.2f}), so compare creators on "
            f"engagement only within the same subscriber tier.")


def build_recommendations(s: dict[str, Any]) -> list[dict[str, str]]:
    fm = {f["key"]: f for f in s["formats"]}
    lab_c = s["meta"]["periods"][1]["label"]
    subs = _corr(s, "subscriber_count", "rvi")
    subs_eng = _corr(s, "subscriber_count", "engagement_ratio")
    dur_rvi = _corr(s, "duration_s", "rvi")
    promo = s["promotional_comments"]
    rising = [t["term"] for t in s["emerging_terms"]["titles"]["rising"][:3]]
    fading = [t["term"] for t in s["emerging_terms"]["titles"]["declining"][:2]]
    comment_rising = {t["term"] for t in s["emerging_terms"]["comments"]["rising"]}
    comment_fading = {t["term"] for t in s["emerging_terms"]["comments"]["declining"]}
    echoed = [t for t in rising if t in comment_rising] + [t for t in fading if t in comment_fading]
    cats = [c for c in s["categories"] if c["key"] != "other" and c["negative_q_value"] is not None]
    friction = min(cats, key=lambda c: c["negative_q_value"])
    best_bin = max((b for b in s["duration_bins"] if b["n_rvi_all"] >= 30),
                   key=lambda b: b["median_rvi_all"])

    recs = [
        {
            "audience": "Creators",
            "title": "Build for reach with long-form, for interaction with Shorts",
            "body": (f"Across both windows the {best_bin['label']} band earns the most reach relative to videos "
                     f"of the same age (median {best_bin['median_rvi_all']:.2f}× the typical video), and in "
                     f"{lab_c} the duration–reach correlation rose to {dur_rvi['curr']['rho']:.2f}. Shorts are now "
                     f"a minority of what surfaces but carry a higher engagement ratio "
                     f"({fm['short']['engagement']['median_curr']:.2f}% vs "
                     f"{fm['long']['engagement']['median_curr']:.2f}% for long-form, on only "
                     f"{fm['short']['engagement']['n_curr']} Shorts): use them to start conversations, not to "
                     f"win discovery."),
        },
        {
            "audience": "Creators",
            "title": f"Follow the vocabulary: {', '.join(rising[:2])}",
            "body": (f"Title terms gaining weight: {', '.join(f'“{t}”' for t in rising)}. Fading: "
                     f"{', '.join(f'“{t}”' for t in fading)}. "
                     + (f"{', '.join(f'“{t}”' for t in echoed)} move the same way in what viewers write in "
                        f"comments, which makes it a demand signal and not only a creator trend."
                        if echoed else
                        "Viewer comments do not show the same shift yet, so treat it as a creator-side trend.")),
        },
        {
            "audience": "Brands",
            "title": "Audit comment sections before reading sentiment",
            "body": (f"{promo['prev']['video_share']:.0f}% of last year's videos in this niche carried coordinated "
                     f"brand-promotion comments. Positive-sounding comment sections can be bought: require "
                     f"organic-engagement reporting (with spam and creator comments removed) before using "
                     f"comment sentiment as a placement KPI."),
        },
        {
            "audience": "Brands",
            "title": "Price reach on channel size, judge quality on engagement",
            "body": (f"Channel size is the most stable predictor of reach in both years (Spearman ρ subscribers × "
                     f"relative velocity = {subs['prev']['rho']:.2f} → {subs['curr']['rho']:.2f}). Use it to set "
                     f"CPM expectations. "
                     + _subs_engagement_sentence(subs_eng)),
        },
        {
            "audience": "Brands",
            "title": f"Watch {friction['label']} as an early friction signal",
            "body": (f"Negative organic comments in {friction['label']} went from "
                     f"{friction['negative_share_prev']:.1f}% to {friction['negative_share_curr']:.1f}% "
                     f"({_q(friction['negative_q_value'])}). "
                     + ("That is significant after correction: plan moderation for integrations there."
                        if _sig(friction["negative_q_value"]) else
                        "Not significant after correcting for multiple tests: monitor it, but don't act on it yet.")),
        },
    ]
    return recs
