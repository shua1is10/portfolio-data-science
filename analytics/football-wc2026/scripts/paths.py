"""
paths.py
Rutas absolutas del pipeline, independientes del directorio desde el que se ejecute.
"""

from pathlib import Path

PROJECT   = Path(__file__).resolve().parents[1]   # analytics/football-wc2026
REPO      = PROJECT.parents[1]
RAW, PROCESSED = PROJECT / "data/raw", PROJECT / "data/processed"
MODELS, LOCAL  = PROJECT / "models", PROJECT / ".local"
WEB_DATA  = REPO / "data" / "football"            # lo que lee el dashboard

# .local/ esta en .gitignore: no existe en un clon nuevo y SQLite no crea directorios
LOCAL.mkdir(exist_ok=True)
