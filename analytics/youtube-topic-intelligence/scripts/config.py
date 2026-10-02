"""
config.py
Configuracion central del pipeline: rutas, ventanas temporales, taxonomia y umbrales.
Todas las rutas son absolutas (pathlib), independientes del directorio de ejecucion.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

# -----------------------------------------------------------------------------
# Rutas
# -----------------------------------------------------------------------------
PROJECT: Path = Path(__file__).resolve().parents[1]      # analytics/youtube-topic-intelligence
REPO: Path = PROJECT.parents[1]
RAW_DIR: Path = PROJECT / "data" / "raw"                  # cache de la API / dataset sintetico (gitignored)
PROCESSED_DIR: Path = PROJECT / "data" / "processed"
WEB_SERVER_DIR: Path = REPO / "data" / "youtube-topic-intelligence"           # leido con fs (case study)
WEB_PUBLIC_DIR: Path = REPO / "public" / "data" / "youtube-topic-intelligence"  # fetch del dashboard

# -----------------------------------------------------------------------------
# Alcance del estudio
# -----------------------------------------------------------------------------
TOPIC: str = "Generative AI & AI Agents"
# 3 queries x 18 meses x 100 u = 5,400 u de search.list: deja ~4,000 u para comentarios.
SEARCH_QUERIES: tuple[str, ...] = ("AI agents", "generative AI", "AI tools")
SNAPSHOT: date = date(2026, 9, 30)   # fecha de corte de las metricas acumuladas
SEED: int = 2026


@dataclass(frozen=True)
class Period:
    key: str
    label: str
    start: date
    end: date


# Ventanas YTD emparejadas (ene-sep) para neutralizar la estacionalidad.
PERIODS: tuple[Period, Period] = (
    Period("prev", "2025 YTD", date(2025, 1, 1), date(2025, 9, 30)),
    Period("curr", "2026 YTD", date(2026, 1, 1), date(2026, 9, 30)),
)

# -----------------------------------------------------------------------------
# Umbrales analiticos
# -----------------------------------------------------------------------------
MATURITY_DAYS: int = 14     # videos mas jovenes se excluyen de metricas de velocidad
AGE_BAND_DAYS: int = 30     # ancho de la franja de edad para el Relative Velocity Index
MIN_VIEWS: int = 100        # por debajo, EER es demasiado ruidoso (denominador minusculo)
BOOTSTRAP_RESAMPLES: int = 1000
CRITICAL_THRESHOLD: float = -0.05   # compound <= umbral -> comentario critico
POSITIVE_THRESHOLD: float = 0.05

# Formatos. Desde oct-2024 los Shorts admiten hasta 180 s, por eso el corte es 3 min.
FORMATS: tuple[tuple[str, str, float, float], ...] = (
    ("short", "Short-form (≤3 min)", 0, 180),
    ("mid", "Mid-length (3–20 min)", 180, 1200),
    ("long", "Long-form (>20 min)", 1200, float("inf")),
)

DURATION_BINS: tuple[tuple[str, float, float], ...] = (
    ("<1m", 0, 60),
    ("1–3m", 60, 180),
    ("3–8m", 180, 480),
    ("8–12m", 480, 720),
    ("12–20m", 720, 1200),
    ("20–40m", 1200, 2400),
    ("40m+", 2400, float("inf")),
)

# Buckets de sentimiento (indice -100..100), fijos para que los filtros no los muevan.
SENTIMENT_BUCKETS: tuple[tuple[str, float, float], ...] = (
    ("Very negative", -101, -30),
    ("Negative", -30, -5),
    ("Neutral", -5, 5),
    ("Positive", 5, 30),
    ("Very positive", 30, 101),
)

# -----------------------------------------------------------------------------
# Taxonomia de subtopicos (clasificador por reglas sobre titulo + tags).
# El orden define el desempate.
# -----------------------------------------------------------------------------
CATEGORIES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("agents", "Agents & Automation",
     ("agent", "agents", "automate", "automation", "workflow", "autonomous", "multi-agent", "n8n", "zapier")),
    ("tutorials", "Tutorials & How-to",
     ("tutorial", "how to", "step by step", "beginners", "guide", "learn", "course", "explained")),
    ("reviews", "Tool Reviews",
     (" vs ", "review", "tested", "best ai", "ranked", "comparison", "worth it")),
    ("news", "News & Releases",
     ("released", "news", "update", "announced", "breaking", "launch", "just dropped")),
    ("opinion", "Opinion & Ethics",
     ("replacing", "dark side", "stopped using", "hype", "trust", "ethics", "dangerous", "bubble")),
    ("monetization", "Career & Monetization",
     ("$", "make money", "side hustle", "income", "agency", "skills that pay", "per month", "/month")),
)
OTHER_CATEGORY: tuple[str, str] = ("other", "Other / Mixed")
