"""
config.py
Configuracion central del pipeline: rutas, ventanas temporales, muestreo, taxonomia y umbrales.
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
RAW_FILE: Path = PROJECT / "data" / "raw" / "youtube_topic_raw.json"   # gitignored: comentarios de terceros
PROCESSED_DIR: Path = PROJECT / "data" / "processed"
WEB_SERVER_DIR: Path = REPO / "data" / "youtube-topic-intelligence"           # leido con fs (case study)
WEB_PUBLIC_DIR: Path = REPO / "public" / "data" / "youtube-topic-intelligence"  # fetch del dashboard
ENV_FILES: tuple[Path, ...] = (REPO / ".env.local", REPO / ".env")

# -----------------------------------------------------------------------------
# Alcance del estudio
# -----------------------------------------------------------------------------
TOPIC: str = "AI Agents & Automation"
SEARCH_QUERIES: tuple[str, ...] = ("AI agents", "AI automation")
# 2 queries x 18 meses x 12 resultados = 432 IDs como maximo (antes de deduplicar y filtrar).
# Cuota: 36 llamadas a search.list x 100 u = 3,600 u + ~10 u de videos/channels + ~430 u de comentarios.
RESULTS_PER_QUERY_MONTH: int = 12
COMMENTS_PER_VIDEO: int = 20
QUOTA_BUDGET: int = 9_000            # de las 10,000 u diarias por defecto
REQUEST_PAUSE_S: float = 0.15        # pausa entre llamadas (cortesia con el rate limit)

# Un video entra al estudio si su titulo, descripcion o tags mencionan alguno de estos terminos.
# search.list devuelve resultados laterales (musica, gaming, otros idiomas); esto los filtra.
RELEVANCE_TERMS: tuple[str, ...] = (
    "ai", "a.i.", "agent", "agents", "agentic", "automation", "automate", "automated", "llm",
    "gpt", "chatgpt", "openai", "claude", "anthropic", "gemini", "copilot", "n8n", "zapier",
    "make.com", "langchain", "crewai", "autogen", "rag", "mcp", "workflow",
)

SEED: int = 2026

# Comentarios promocionales (astroturfing): textos unicos, a menudo generados con IA, que elogian
# el video y mencionan siempre el mismo producto. No los atrapa el filtro de duplicados exactos.
# Candidatos propuestos por spam_report() (nombre propio en comentarios de >= 8 videos que
# nunca lo mencionan, ~1 vez por video) y confirmados por revision manual el 2026-10-02.
# Se excluyen del sentimiento y de los terminos, y se reportan aparte en el resumen.
PROMO_BRANDS: tuple[str, ...] = ("pneumaticworkflow", "aicarma", "rumora", "workbeaver", "backboardio")


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
MIN_VIEWS: int = 100        # por debajo, el engagement ratio es demasiado ruidoso
MIN_GROUP_N: int = 15       # minimo de videos para reportar la mediana de un grupo
MIN_COMMENTS_FOR_SENTIMENT: int = 5   # comentarios en ingles necesarios para el indice por video
BOOTSTRAP_RESAMPLES: int = 2000
ALPHA: float = 0.05
# Umbrales estandar de VADER sobre el compound
NEGATIVE_THRESHOLD: float = -0.05
POSITIVE_THRESHOLD: float = 0.05

# Formatos (definicion del brief). Ojo: desde oct-2024 los Shorts admiten hasta 180 s,
# por lo que parte de los Shorts reales cae en "mid"; DURATION_BINS separa el tramo 1-3 min.
FORMATS: tuple[tuple[str, str, float, float], ...] = (
    ("short", "Short (<1 min)", 0, 60),
    ("mid", "Mid-length (1–10 min)", 60, 600),
    ("long", "Long-form (>10 min)", 600, float("inf")),
)

# Intervalos (lo, hi]; los cortes 60 y 600 coinciden con FORMATS.
DURATION_BINS: tuple[tuple[str, float, float], ...] = (
    ("<1m", 0, 60),
    ("1–3m", 60, 180),
    ("3–10m", 180, 600),
    ("10–20m", 600, 1200),
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
# Taxonomia de subtopicos (clasificador por reglas sobre titulo + tags, limites de palabra).
# Disenada a partir de los titulos reales de la muestra (ver RESEARCH_NOTES.md §2).
# El orden define el desempate.
# -----------------------------------------------------------------------------
CATEGORIES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("build", "Build & Tutorials",
     ("tutorial", "how to", "step by step", "step-by-step", "guide", "course", "build", "built",
      "building", "create", "setup", "set up", "from scratch", "template", "no code", "no-code",
      "crash course", "workflow", "workflows")),
    ("explainers", "Explainers & Concepts",
     ("what is", "what are", "what's", "explained", "fundamentals", "foundations", "basics", "terms",
      "how do", "how does", "difference between", "types of", "design pattern", "patterns",
      "principles", "beginners", "beginner", "understand", "introduction", "intro to", "101")),
    ("tools", "Tools & Launches",
     (" vs ", "review", "tested", "tried", "best", "top 5", "top 10", "tools", "apps", "alternative",
      "new", "released", "launch", "update", "announced", "news", "just dropped", "introducing")),
    ("business", "Business & Monetization",
     ("$", "money", "side hustle", "income", "agency", "clients", "business", "selling", "sell",
      "startup", "saas", "marketing", "lead generation", "sales", "cold email", "cold emails",
      "faceless", "revenue", "customers")),
    ("risks", "Risks & Future of Work",
     ("replace", "replacing", "jobs", "future", "disrupt", "problem", "sucks", "nobody tells",
      "security", "securing", "risk", "risks", "governing", "hack", "dangerous", "hype", "bubble",
      "truth", "ethics", "superintelligence", "will ai", "trust")),
)
OTHER_CATEGORY: tuple[str, str] = ("other", "Other / Mixed")
