"""
synthetic.py
Dataset sintetico representativo con el MISMO esquema que produce youtube_api.normalize().
Se usa mientras no haya YOUTUBE_API_KEY. Es determinista (SEED) y su escenario esta
declarado en SCENARIO para que cualquier "hallazgo" pueda contrastarse con lo sembrado:
sobre datos sinteticos el pipeline demuestra que el METODO recupera los efectos, no que
esos efectos existan en YouTube.

Mecanismos simulados (y por que importan para el analisis):
  - Acumulacion de vistas saturante V(t) = V_inf * (1 - e^(-t/tau)) + cola evergreen:
    hace que vistas crudas y Views/Days esten sesgadas por la antiguedad.
  - Efecto edad leve en engagement (los primeros espectadores son suscriptores):
    obliga a medir la sensibilidad del EER a la edad antes de comparar periodos.
  - Comentarios en texto libre (con negaciones y contrastes): el sentimiento se
    obtiene con NLP sobre el texto, no se lee de una etiqueta.
"""

from __future__ import annotations

import math
import random
import string
from datetime import date, datetime, time
from typing import Any

from config import PERIODS, SNAPSHOT

# -----------------------------------------------------------------------------
# Escenario sembrado (supuestos explicitos; ver RESEARCH_NOTES.md §3)
# -----------------------------------------------------------------------------
SCENARIO: dict[str, Any] = {
    "videos_per_period": {"prev": 920, "curr": 1420},          # +54% de oferta
    "month_weights": {
        "prev": [0.92, 0.95, 0.97, 1.0, 1.0, 1.02, 1.03, 1.05, 1.06],
        "curr": [0.80, 0.86, 0.92, 0.98, 1.03, 1.08, 1.12, 1.18, 1.23],
    },
    "category_mix": {
        "prev": {"tutorials": .27, "reviews": .18, "news": .23, "agents": .09, "opinion": .10, "monetization": .13},
        "curr": {"tutorials": .22, "reviews": .16, "news": .13, "agents": .27, "opinion": .12, "monetization": .10},
    },
    "format_mix": {   # short / mid / long
        "prev": (0.34, 0.46, 0.20),
        "curr": (0.47, 0.38, 0.15),
    },
    # multiplicador de engagement por periodo x formato (prev = 1.0)
    "curr_engagement_mult": {"short": 0.80, "mid": 1.18, "long": 1.04},
    # demanda por video (vistas de vida) en curr: saturacion general, agentes resisten
    "curr_demand_mult": {"default": 0.80, "agents": 1.25},
    # mezcla de comentarios (positivo, negativo, neutro)
    "comment_mix": {
        "prev": {"tutorials": (.62, .11, .27), "reviews": (.50, .19, .31), "news": (.42, .17, .41),
                 "agents": (.58, .13, .29), "opinion": (.31, .27, .42), "monetization": (.40, .28, .32)},
        "curr": {"tutorials": (.61, .12, .27), "reviews": (.48, .21, .31), "news": (.41, .19, .40),
                 "agents": (.55, .18, .27), "opinion": (.33, .41, .26), "monetization": (.36, .37, .27)},
    },
}

TOOLS = ["ChatGPT", "Claude", "Gemini", "Copilot", "Midjourney", "Cursor", "Perplexity",
         "Llama", "Grok", "DeepSeek", "Notion AI", "Runway"]
TASKS = ["coding", "excel", "marketing", "research", "emails", "SEO", "data analysis",
         "video editing", "customer support", "content writing", "lead generation"]
THINGS = ["web app", "chatbot", "SaaS", "dashboard", "Chrome extension", "trading bot", "RAG system"]
FEATURES = ["a new reasoning model", "voice mode", "agent mode", "memory", "a coding agent",
            "computer use", "deep research", "video generation"]
JOBS = ["programmers", "designers", "writers", "analysts", "marketers", "teachers"]

TITLE_TEMPLATES: dict[str, list[str]] = {
    "tutorials": [
        "How to use {tool} for {task} (step by step)", "{tool} tutorial for beginners",
        "Learn {tool} in {n} minutes", "Build a {thing} with {tool} - full guide",
        "{tool} prompt engineering course for {task}", "{tool} explained for {task}",
    ],
    "reviews": [
        "{tool} vs {tool2}: which is better for {task}?", "I tested {n} AI tools for {task}",
        "{tool} honest review after {n} days", "Best AI tools for {task} ranked",
        "Is {tool} worth it? Full review", "{tool} vs {tool2} comparison",
    ],
    "news": [
        "{tool} just released {feature}", "AI news this week: {tool} update",
        "Breaking: {tool} announced {feature}", "{tool} launch changes everything",
        "Huge {tool} update just dropped", "AI news: {tool} and {tool2} announced {feature}",
    ],
    "agents": [
        "Build an AI agent that does {task} with {tool}", "Autonomous AI agents for {task}",
        "Automate {task} with {tool} agents", "Multi-agent workflow with {tool} and n8n",
        "My AI automation stack for {task}", "AI agents automate my {task} workflow",
    ],
    "opinion": [
        "Is AI replacing {job}?", "The dark side of generative AI", "Why I stopped using {tool}",
        "AI hype is out of control", "Should we trust {tool} with {task}?", "Is the AI bubble about to pop?",
    ],
    "monetization": [
        "How I make ${n}k/month with AI", "AI side hustles to make money in {year}",
        "{n} AI skills that pay in {year}", "Start an AI automation agency from zero",
        "Passive income with {tool}: make money online", "AI income: ${n}k per month with {tool}",
    ],
}
AMBIGUOUS_TEMPLATES = ["{tool} tips you need to know", "I spent a week with {tool}",
                       "{tool} changed how I work", "Everything about {tool}"]

POSITIVE = ["this is amazing", "super helpful thanks", "great explanation", "love this channel",
            "finally a clear tutorial", "really useful workflow", "best video on this topic",
            "saved me hours", "brilliant content", "subscribed, valuable stuff", "so easy to follow"]
NEGATIVE = ["this is clickbait", "not helpful at all", "terrible audio", "overhyped garbage",
            "misleading title", "AI is ruining everything", "waste of time", "this is scary and dangerous",
            "another scam course", "lazy AI slop", "this is wrong", "worst advice ever"]
NEUTRAL = ["what mic do you use", "which version is this", "first", "timestamp please",
           "does it run on mac", "can you share the prompt", "watching from Brazil", "what model is that"]
MIXED = ["good video but too long", "not bad, but the audio is terrible", "great tool but overhyped",
         "clickbait title but useful content", "not useless, but outdated"]
BOOST_PREFIX = ["honestly ", "really ", "absolutely ", ""]

ID_ALPHABET = string.ascii_letters + string.digits + "-_"


def _video_id(rng: random.Random) -> str:
    return "".join(rng.choice(ID_ALPHABET) for _ in range(11))


def _weighted(rng: random.Random, weights: dict[str, float]) -> str:
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def _duration(rng: random.Random, fmt: str, period: str) -> int:
    if fmt == "short":
        # desde oct-2024 los Shorts pueden durar hasta 3 min; en 2026 se usa mas ese margen
        long_short = 0.30 if period == "curr" else 0.10
        return rng.randint(61, 180) if rng.random() < long_short else rng.randint(12, 60)
    if fmt == "mid":
        return int(rng.triangular(3.05, 20, 10) * 60)
    return int(min(20 + rng.expovariate(1 / 22), 180) * 60)


def _title(rng: random.Random, category: str, year: int) -> str:
    pool = AMBIGUOUS_TEMPLATES if rng.random() < 0.07 else TITLE_TEMPLATES[category]
    tool, tool2 = rng.sample(TOOLS, 2)
    return rng.choice(pool).format(
        tool=tool, tool2=tool2, task=rng.choice(TASKS), thing=rng.choice(THINGS),
        feature=rng.choice(FEATURES), job=rng.choice(JOBS), n=rng.choice([5, 7, 10, 12, 30]),
        year=year,
    )


def _comment(rng: random.Random, mix: tuple[float, float, float]) -> str:
    if rng.random() < 0.10:
        return rng.choice(MIXED)
    kind = rng.choices(("pos", "neg", "neu"), weights=mix)[0]
    bank = {"pos": POSITIVE, "neg": NEGATIVE, "neu": NEUTRAL}[kind]
    prefix = rng.choice(BOOST_PREFIX) if kind != "neu" and rng.random() < 0.25 else ""
    return prefix + rng.choice(bank)


def generate(seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    s = SCENARIO

    channels = []
    for i in range(650):
        subs = int(min(max(math.exp(rng.gauss(math.log(35_000), 1.5)), 300), 9_000_000))
        channels.append({"id": f"UC{_video_id(rng)}{i:04d}", "title": f"Channel {i:03d}", "subs": subs})
    channel_weights = [c["subs"] ** 0.35 for c in channels]   # canales grandes publican mas

    videos: list[dict[str, Any]] = []
    for period in PERIODS:
        p = period.key
        n_total = s["videos_per_period"][p]
        months = s["month_weights"][p]
        for _ in range(n_total):
            month = rng.choices(range(1, 10), weights=months)[0]
            day = rng.randint(1, 28 if month == 2 else 30)
            published = datetime.combine(date(period.start.year, month, day),
                                         time(rng.randint(0, 23), rng.randint(0, 59)))
            age = max((SNAPSHOT - published.date()).days, 1)

            category = _weighted(rng, s["category_mix"][p])
            fmt_weights = list(s["format_mix"][p])
            if category == "news":
                fmt_weights[0] += 0.15
            if category in ("tutorials", "agents"):
                fmt_weights[2] += 0.06
            fmt = rng.choices(("short", "mid", "long"), weights=fmt_weights)[0]
            duration = _duration(rng, fmt, p)

            ch = rng.choices(channels, weights=channel_weights)[0]
            quality = rng.gauss(0, 1)   # latente: mejores videos -> mas vistas y mejor tono

            # --- vistas de vida y acumulacion -------------------------------------------
            fmt_mult = {"short": 2.0, "mid": 1.0, "long": 0.7}[fmt]
            cat_mult = {"tutorials": 1.1, "reviews": 1.2, "news": 0.9, "agents": 1.15,
                        "opinion": 1.0, "monetization": 1.05}[category]
            demand = 1.0
            if p == "curr":
                demand = s["curr_demand_mult"].get(category, s["curr_demand_mult"]["default"])
            log_v_inf = (0.85 * math.log(ch["subs"]) + rng.gauss(0, 0.95) + 0.35 * quality
                         + math.log(fmt_mult * cat_mult * demand))
            v_inf = math.exp(log_v_inf)
            tau = {"short": 5, "mid": 25, "long": 35}[fmt]
            evergreen = {"tutorials": 0.25, "agents": 0.12, "news": 0.0}.get(category, 0.05)
            views = int(v_inf * (1 - math.exp(-age / tau)) + v_inf * evergreen * age / 365)

            # --- comentarios (texto) -------------------------------------------------------
            mix = list(s["comment_mix"][p][category])
            shift = 0.06 * max(min(quality, 2), -2)
            mix[0] = max(mix[0] + shift, 0.02)
            mix[1] = max(mix[1] - shift, 0.02)
            if fmt == "short":
                mix[2] += 0.10   # comentarios de bajo esfuerzo

            # --- engagement ----------------------------------------------------------------
            like_rate = math.exp(rng.gauss(math.log({"short": 0.040, "mid": 0.036, "long": 0.032}[fmt]), 0.35))
            comment_rate = math.exp(rng.gauss(math.log({"short": 0.0010, "mid": 0.0035, "long": 0.0045}[fmt]), 0.45))
            mult = s["curr_engagement_mult"][fmt] if p == "curr" else 1.0
            if fmt == "mid":
                mult *= 1 + 0.12 * math.exp(-(((duration / 60) - 10) / 4) ** 2)   # pico 8-12 min
            like_rate *= mult * {"agents": 1.10, "tutorials": 1.08, "news": 0.85,
                                 "opinion": 0.90, "monetization": 0.95}.get(category, 1.0)
            comment_rate *= mult * (1.8 if category == "opinion" else 1.0)
            age_boost = 1 + 0.15 * math.exp(-age / 10)
            tone = (mix[0] - mix[1])
            like_rate *= age_boost * (1 + 0.25 * tone)
            comment_rate *= age_boost * (1 + 0.6 * max(0.0, -tone))

            likes = int(views * min(like_rate, 0.25))
            n_comments = int(views * min(comment_rate, 0.05))
            n_sample = min(n_comments, rng.randint(6, 16))
            texts = [_comment(rng, (mix[0], mix[1], mix[2])) for _ in range(n_sample)]

            tags = [rng.choice(TOOLS).lower(), "ai", "artificial intelligence"]
            videos.append({
                "video_id": _video_id(rng),
                "title": _title(rng, category, period.start.year),
                "tags": tags,
                "channel_id": ch["id"],
                "channel_title": ch["title"],
                "subscriber_count": ch["subs"],
                "published_at": published.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "duration_s": duration,
                "views": views,
                "likes": likes,
                "comments": n_comments,
                "comment_texts": texts,
                "truth_category": category,
            })
    return videos

