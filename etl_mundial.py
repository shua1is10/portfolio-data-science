"""
ETL Pipeline - FIFA World Cup 2026 Group Stage Prediction
Data Engineering Agent | Mundial 2026
"""

import os
import json
import time
import logging
from datetime import datetime, timezone
from itertools import cycle
from typing import Optional

import requests
import requests_cache
import pandas as pd
from dotenv import load_dotenv
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    Date, DateTime, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship, Session

# ---------------------------------------------------------------------------
# Config & Logging
# ---------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
log = logging.getLogger(__name__)

STATE_FILE = "estado.json"
DB_FILE = "mundial2026.db"
CACHE_FILE = "http_cache"

# World Cup 2026 host venues with approximate altitude (meters)
WC2026_VENUES = {
    "New York/New Jersey": {"city": "East Rutherford", "country": "US", "altitude_m": 9},
    "Los Angeles":         {"city": "Inglewood",        "country": "US", "altitude_m": 36},
    "Dallas":              {"city": "Arlington",         "country": "US", "altitude_m": 192},
    "San Francisco":       {"city": "Santa Clara",       "country": "US", "altitude_m": 24},
    "Miami":               {"city": "Miami Gardens",     "country": "US", "altitude_m": 3},
    "Seattle":             {"city": "Seattle",           "country": "US", "altitude_m": 74},
    "Boston":              {"city": "Foxborough",        "country": "US", "altitude_m": 36},
    "Houston":             {"city": "Houston",           "country": "US", "altitude_m": 15},
    "Philadelphia":        {"city": "Philadelphia",      "country": "US", "altitude_m": 12},
    "Kansas City":         {"city": "Kansas City",       "country": "US", "altitude_m": 270},
    "Atlanta":             {"city": "Atlanta",           "country": "US", "altitude_m": 320},
    "Mexico City":         {"city": "Mexico City",       "country": "MX", "altitude_m": 2240},
    "Guadalajara":         {"city": "Guadalajara",       "country": "MX", "altitude_m": 1566},
    "Monterrey":           {"city": "Monterrey",         "country": "MX", "altitude_m": 537},
    "Toronto":             {"city": "Toronto",           "country": "CA", "altitude_m": 76},
    "Vancouver":           {"city": "Vancouver",         "country": "CA", "altitude_m": 3},
}

# ---------------------------------------------------------------------------
# State Manager (fault-tolerant resume)
# ---------------------------------------------------------------------------
class StateManager:
    def __init__(self, path: str = STATE_FILE):
        self.path = path
        self.state = self._load()

    def _load(self) -> dict:
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "scraped_page": False,
            "teams_fetched": [],
            "players_fetched": [],
            "coaches_fetched": [],
            "stats_fetched": [],
            "context_fetched": [],
            "last_updated": None,
        }

    def save(self):
        self.state["last_updated"] = datetime.now(timezone.utc).isoformat()
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.state, f, indent=2)
        log.info("Estado guardado en %s", self.path)

    def mark(self, key: str, value):
        self.state[key] = value
        self.save()


# ---------------------------------------------------------------------------
# Key Manager (API-Football rate-limit rotation)
# ---------------------------------------------------------------------------
class KeyManager:
    def __init__(self):
        raw = os.getenv("RAPIDAPI_KEYS", "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        if not keys:
            raise ValueError("RAPIDAPI_KEYS not found in .env — add your keys before running.")
        self._n    = len(keys)
        self._pool = cycle(keys)
        self.current = next(self._pool)
        log.info("KeyManager: %d API-Football keys cargadas.", self._n)

    def rotate(self) -> None:
        self.current = next(self._pool)
        print(f"[WARNING] Llave agotada. Cambiando a la siguiente llave...")
        log.warning("Rotando a siguiente key de RapidAPI: %s…", self.current[:8])

    def headers(self) -> dict:
        return {
            "x-rapidapi-key":  self.current,
            "x-rapidapi-host": "v3.football.api-sports.io",
        }

    @staticmethod
    def _quota_exhausted(resp) -> bool:
        """Return True if this response signals that the current key's quota is gone."""
        # HTTP-level signals
        if resp.status_code in (429, 403):
            return True
        # Rate-limit header (API-Football sets this to 0 when the daily cap is hit)
        remaining = resp.headers.get("X-RateLimit-requests-Remaining", "1")
        try:
            if int(remaining) == 0:
                return True
        except ValueError:
            pass
        # Body-level signal: API-Football puede devolver HTTP 200 con errors en JSON.
        # Cualquier campo 'errors' no vacío indica que la llave falló; rotamos sin filtrar keywords.
        try:
            errors = resp.json().get("errors", {})
            if errors:
                print(f"[DEBUG] API-Football errors en body (llave {resp.request.headers.get('x-rapidapi-key','?')[:8]}…): {errors}")
                return True
        except Exception:
            pass
        return False

    def get(self, url: str, params: dict = None) -> Optional[dict]:
        """
        Make a GET request, rotating through all available keys on quota errors.
        Raises RuntimeError if every key is exhausted without a successful response.
        """
        for attempt in range(self._n):
            try:
                resp = requests.get(url, headers=self.headers(), params=params, timeout=15)
                if self._quota_exhausted(resp):
                    log.warning(
                        "Cuota agotada en key %s (status=%s, intento %d/%d).",
                        self.current[:8], resp.status_code, attempt + 1, self._n,
                    )
                    self.rotate()
                    time.sleep(2)
                    continue
                resp.raise_for_status()
                return resp.json()
            except requests.RequestException as exc:
                log.error("Error de red (intento %d/%d): %s", attempt + 1, self._n, exc)
                time.sleep(3)

        raise RuntimeError("Todas las llaves de la API se han agotado. Deteniendo ETL.")


# ---------------------------------------------------------------------------
# Database Schema (SQLAlchemy ORM)
# ---------------------------------------------------------------------------
Base = declarative_base()


class Team(Base):
    __tablename__ = "Teams"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    api_football_id = Column(Integer, unique=True, nullable=True)
    name            = Column(String(100), nullable=False)
    fifa_code       = Column(String(10))
    confederation   = Column(String(20))          # UEFA, CONMEBOL, etc.
    group_letter    = Column(String(5))            # A-L
    country         = Column(String(80))
    logo_url        = Column(Text)
    ranking_fifa    = Column(Integer)
    scraped_source  = Column(String(200))
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    coaches = relationship("Coach", back_populates="team")
    players = relationship("Player", back_populates="team")


class Coach(Base):
    __tablename__ = "Coaches"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    team_id         = Column(Integer, ForeignKey("Teams.id"))
    api_football_id = Column(Integer, unique=True, nullable=True)
    full_name       = Column(String(150), nullable=False)
    nationality     = Column(String(80))
    birth_date      = Column(Date, nullable=True)
    age             = Column(Integer)
    photo_url       = Column(Text)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    team   = relationship("Team", back_populates="coaches")
    stats  = relationship("CoachStats", back_populates="coach", uselist=False)


class Player(Base):
    __tablename__ = "Players"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    team_id         = Column(Integer, ForeignKey("Teams.id"))
    api_football_id = Column(Integer, unique=True, nullable=True)
    full_name       = Column(String(150), nullable=False)
    nationality     = Column(String(80))
    birth_date      = Column(Date, nullable=True)
    age             = Column(Integer)
    position        = Column(String(30))           # GK, DF, MF, FW
    shirt_number    = Column(Integer)
    club_name       = Column(String(100))
    club_city       = Column(String(100))
    club_country    = Column(String(80))
    club_latitude   = Column(Float)
    club_longitude  = Column(Float)
    club_altitude_m = Column(Float)
    market_value_eur= Column(Float)                # Transfermarkt
    is_star         = Column(Boolean, default=False)
    photo_url       = Column(Text)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    team   = relationship("Team", back_populates="players")
    stats  = relationship("PlayerStats", back_populates="player", uselist=False)


class PlayerStats(Base):
    """
    Per-player aggregated season stats from API-Football + FBref (direct scraping).
    """
    __tablename__ = "Player_Stats"
    id                     = Column(Integer, primary_key=True, autoincrement=True)
    player_id              = Column(Integer, ForeignKey("Players.id"), unique=True)
    season                 = Column(String(10))    # e.g. "2024/25"
    # Appearance & time
    appearances            = Column(Integer)
    minutes_played         = Column(Integer)
    starts                 = Column(Integer)
    # Attacking
    goals                  = Column(Integer)
    assists                = Column(Integer)
    shots_total            = Column(Integer)
    shots_on_target        = Column(Integer)
    xg                     = Column(Float)         # FBref via direct scraping
    xa                     = Column(Float)         # FBref via direct scraping
    # Passing
    passes_total           = Column(Integer)
    passes_accuracy_pct    = Column(Float)
    key_passes             = Column(Integer)
    # Defensive
    tackles                = Column(Integer)
    interceptions          = Column(Integer)
    duels_won_pct          = Column(Float)
    # Discipline
    yellow_cards           = Column(Integer)
    red_cards              = Column(Integer)
    # Physical / injuries
    injury_days_missed     = Column(Integer)       # Transfermarkt
    injuries_last_3seasons = Column(Integer)       # Transfermarkt
    # Altitude adaptability
    max_altitude_delta_m   = Column(Float)         # max(venue_alt) - club_altitude
    min_altitude_delta_m   = Column(Float)
    # International
    intl_caps              = Column(Integer)
    intl_goals             = Column(Integer)
    # Club ELO
    club_elo_rating        = Column(Float)         # ClubElo.API
    league_rank_europe     = Column(Integer)       # 1=top league, 5=low
    updated_at             = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player = relationship("Player", back_populates="stats")


class CoachStats(Base):
    """
    Coaching record from API-Football.
    """
    __tablename__ = "Coach_Stats"
    id                     = Column(Integer, primary_key=True, autoincrement=True)
    coach_id               = Column(Integer, ForeignKey("Coaches.id"), unique=True)
    career_matches         = Column(Integer)
    career_wins            = Column(Integer)
    career_draws           = Column(Integer)
    career_losses          = Column(Integer)
    win_rate_pct           = Column(Float)
    intl_matches           = Column(Integer)       # with national team
    intl_wins              = Column(Integer)
    intl_draws             = Column(Integer)
    intl_losses            = Column(Integer)
    intl_win_rate_pct      = Column(Float)
    wc_qualifiers_played   = Column(Integer)
    wc_finals_appearances  = Column(Integer)
    preferred_formation    = Column(String(20))    # e.g. "4-3-3"
    press_intensity_score  = Column(Float)         # derived from fbref
    updated_at             = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    coach = relationship("Coach", back_populates="stats")


class ContextData(Base):
    """
    Contextual / external signals: news sentiment, venue altitude delta,
    historical head-to-head, group draw info.
    """
    __tablename__ = "Context_Data"
    id                        = Column(Integer, primary_key=True, autoincrement=True)
    team_id                   = Column(Integer, ForeignKey("Teams.id"))
    context_type              = Column(String(50))  # news|altitude|h2h|group
    # News sentiment (NewsAPI)
    news_sentiment_score      = Column(Float)       # -1 to 1
    news_articles_analyzed    = Column(Integer)
    news_query_player         = Column(String(150))
    # Altitude context
    venue_name                = Column(String(100))
    venue_altitude_m          = Column(Float)
    squad_avg_club_altitude_m = Column(Float)
    altitude_advantage_score  = Column(Float)       # normalized delta
    # Head-to-head
    opponent_team_id          = Column(Integer, ForeignKey("Teams.id"), nullable=True)
    h2h_matches               = Column(Integer)
    h2h_wins                  = Column(Integer)
    h2h_draws                 = Column(Integer)
    h2h_losses                = Column(Integer)
    # Raw JSON blob for extensibility
    raw_json                  = Column(Text)
    fetched_at                = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("team_id", "context_type", "venue_name",
                         "opponent_team_id", name="uq_context"),
    )


# ---------------------------------------------------------------------------
# DB Setup
# ---------------------------------------------------------------------------
def init_db(db_path: str = DB_FILE):
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(engine)
    log.info("Base de datos inicializada: %s", db_path)
    return engine


# ---------------------------------------------------------------------------
# Cache Setup
# ---------------------------------------------------------------------------
def init_cache():
    requests_cache.install_cache(
        CACHE_FILE,
        backend="sqlite",
        expire_after=3600 * 24,   # 24 h TTL
        allowable_methods=["GET"],
    )
    log.info("requests-cache activo → %s.sqlite", CACHE_FILE)


# ---------------------------------------------------------------------------
# Step 1: Load teams / players / coaches from local JSON file
# ---------------------------------------------------------------------------
LOCAL_LINEUPS_FILE = "equipos_mundial.json"


def load_local_lineups(state: StateManager) -> list[dict]:
    """
    Reads equipos_mundial.json — a list of dicts with keys:
      'team' (str), 'coach' (str|None), 'players' (list[str])
    Caches the result in estado.json for fault-tolerant resume.
    """
    if state.state.get("scraped_page"):
        log.info("Lineups ya cargados (leyendo desde estado.json).")
        return state.state.get("scraped_data", [])

    if not os.path.exists(LOCAL_LINEUPS_FILE):
        raise FileNotFoundError(
            f"No se encontró '{LOCAL_LINEUPS_FILE}'. "
            "Crea el archivo con la lista de equipos antes de ejecutar el ETL."
        )

    with open(LOCAL_LINEUPS_FILE, "r", encoding="utf-8") as f:
        teams = json.load(f)

    log.info("Lineups cargados desde %s: %d equipos.", LOCAL_LINEUPS_FILE, len(teams))
    state.state["scraped_data"] = teams
    state.mark("scraped_page", True)
    return teams


# ---------------------------------------------------------------------------
# Step 2: Altitude delta for each player's club city vs WC venues
# ---------------------------------------------------------------------------
_geolocator = Nominatim(user_agent="mundial2026_etl", timeout=10)
_geocode = RateLimiter(_geolocator.geocode, min_delay_seconds=1.1)


def get_city_altitude(city: str, country: str) -> Optional[float]:
    """Fetch elevation via open-elevation.com (free, no key needed)."""
    try:
        location = _geocode(f"{city}, {country}")
        if location is None:
            return None
        lat, lon = location.latitude, location.longitude
        elev_resp = requests.get(
            "https://api.open-elevation.com/api/v1/lookup",
            params={"locations": f"{lat},{lon}"},
            timeout=10,
        )
        results = elev_resp.json().get("results", [])
        return float(results[0]["elevation"]) if results else None
    except Exception as exc:
        log.warning("Altitud no disponible para %s/%s: %s", city, country, exc)
        return None


def compute_altitude_deltas(club_city: str, club_country: str) -> dict:
    """Return {venue_name: delta_m} for all WC2026 venues."""
    club_alt = get_city_altitude(club_city, club_country)
    if club_alt is None:
        return {}
    deltas = {}
    for venue, info in WC2026_VENUES.items():
        deltas[venue] = info["altitude_m"] - club_alt
    return deltas


# ---------------------------------------------------------------------------
# Step 3: FBref — disabled (anti-bot protection; xG/xA set to 0)
# ---------------------------------------------------------------------------

def fetch_fbref_stats(player_name: str, league_name: str = "") -> dict:
    """FBref scraping disabled. Returns zeros so the pipeline continues."""
    return {"xg": 0.0, "xa": 0.0}


# ---------------------------------------------------------------------------
# Step 4: Transfermarkt via transfermarkt-api
# (pip install transfermarkt-api  — install separately if needed)
# ---------------------------------------------------------------------------
_TMKT_API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
}
_TMKT_CEAPI_SEARCH = "https://www.transfermarkt.com/ceapi/quickselect/query/{}"
_TMKT_INJURY_URL   = "https://tmapi-alpha.transfermarkt.technology/player/{}/injury"


def fetch_transfermarkt_data(player_name: str) -> dict:
    """
    Pulls market value and injury history from Transfermarkt using synchronous requests.

    Step 1 — ceapi quickselect: resolves player_name → player_id + raw market value.
    Step 2 — tmapi-alpha injury endpoint: fetches injury list for that player_id.

    Returns empty dict silently on any failure.
    """
    try:
        # --- Paso 1: buscar jugador y obtener player_id + valor de mercado ---
        search_url = _TMKT_CEAPI_SEARCH.format(
            player_name.replace(" ", "%20")
        )
        r1 = requests.get(search_url, headers=_TMKT_API_HEADERS, timeout=10)
        r1.raise_for_status()
        players = r1.json().get("players", [])
        if not players:
            log.warning("[TMKT_DATA] Jugador no encontrado en Transfermarkt: %s", player_name)
            return {}

        first      = players[0]
        player_id  = first.get("id")
        if not player_id:
            return {}

        raw_val = str(first.get("marketValue", "0") or "0")
        try:
            market_val = float(
                raw_val.replace("€", "").replace("m", "e6").replace("k", "e3").strip() or "0"
            )
        except ValueError:
            market_val = 0.0

        time.sleep(1)

        # --- Paso 2: lesiones ---
        injury_url = _TMKT_INJURY_URL.format(player_id)
        r2 = requests.get(injury_url, headers=_TMKT_API_HEADERS, timeout=10)
        r2.raise_for_status()
        injuries = r2.json().get("data", {}).get("injuries", [])

        total_days_missed      = 0
        injuries_last_3seasons = 0

        for injury in injuries:
            try:
                total_days_missed += int(
                    injury.get("durationDetails", {}).get("days", 0) or 0
                )
            except (TypeError, ValueError, AttributeError):
                pass
            try:
                if int(injury.get("seasonId", 0)) >= 2023:
                    injuries_last_3seasons += 1
            except (TypeError, ValueError):
                pass

        return {
            "market_value_eur":       market_val,
            "injury_days_missed":     total_days_missed,
            "injuries_last_3seasons": injuries_last_3seasons,
        }

    except Exception as exc:
        log.warning("[TMKT_DATA] Error para '%s': %s", player_name, exc)
        return {}


# ---------------------------------------------------------------------------
# Step 5: ClubElo API
# ---------------------------------------------------------------------------
CLUBELO_BASE = "http://api.clubelo.com"


_CLUBELO_STRIP = [
    " FC", " CF", " SC", " AC", " AS", " RC", " RCD", " SD", " UD",
    " United", " City", " Town", " County", " Rovers", " Wanderers",
    " Athletic", " Albion", " Hotspur", " Alexandra", " Orient",
]


def _clean_club_slug(name: str) -> str:
    """Remove common suffixes and whitespace to match ClubElo URL format."""
    cleaned = name.strip()
    for suffix in _CLUBELO_STRIP:
        if cleaned.upper().endswith(suffix.upper()):
            cleaned = cleaned[: -len(suffix)].strip()
    return cleaned.replace(" ", "")


def fetch_club_elo(club_name: str) -> dict:
    """
    GET http://api.clubelo.com/{ClubName}  → latest ELO rating.
    Returns {"club_elo_rating": float, "league_rank_europe": int}.
    """
    try:
        slug = _clean_club_slug(club_name)
        resp = requests.get(f"{CLUBELO_BASE}/{slug}", timeout=10)
        if resp.status_code != 200:
            return {}
        lines = resp.text.strip().split("\n")
        if len(lines) < 2:
            return {}
        header = lines[0].split(",")
        values = lines[-1].split(",")
        row = dict(zip(header, values))
        elo = float(row.get("Elo", 0))
        level = int(row.get("Level", 5))   # 1 = Champions League level
        return {"club_elo_rating": elo, "league_rank_europe": level}
    except Exception as exc:
        log.warning("ClubElo error para '%s': %s", club_name, exc)
        return {}


# ---------------------------------------------------------------------------
# Step 6: NewsAPI — top 3 stars per team
# ---------------------------------------------------------------------------
NEWSAPI_BASE = "https://newsapi.org/v2/everything"


def fetch_news_sentiment(player_name: str, team_name: str) -> dict:
    api_key = os.getenv("NEWSAPI_KEY", "")
    if not api_key:
        log.warning("NEWSAPI_KEY no encontrada en .env.")
        return {}
    try:
        resp = requests.get(
            NEWSAPI_BASE,
            params={
                "q":        f'"{player_name}" "{team_name}"',
                "language": "en",
                "sortBy":   "publishedAt",
                "pageSize": 20,
                "apiKey":   api_key,
            },
            timeout=10,
        )
        articles = resp.json().get("articles", [])
        if not articles:
            return {"news_sentiment_score": 0.0, "news_articles_analyzed": 0,
                    "news_query_player": player_name}

        # Naive sentiment: ratio positive keywords
        positive = {"win", "goal", "best", "star", "top", "great", "fit", "ready"}
        negative = {"injury", "doubt", "miss", "out", "ban", "crisis", "struggle"}
        pos_count = neg_count = 0
        for art in articles:
            text = (art.get("title", "") + " " + art.get("description", "")).lower()
            pos_count += sum(1 for w in positive if w in text)
            neg_count += sum(1 for w in negative if w in text)

        total = pos_count + neg_count or 1
        score = round((pos_count - neg_count) / total, 4)
        return {
            "news_sentiment_score":   score,
            "news_articles_analyzed": len(articles),
            "news_query_player":      player_name,
        }
    except Exception as exc:
        log.warning("NewsAPI error para '%s': %s", player_name, exc)
        return {}


# ---------------------------------------------------------------------------
# Step 7: API-Football helpers
# ---------------------------------------------------------------------------
APIFOOTBALL_BASE = "https://v3.football.api-sports.io"

# Nombres que API-Football no reconoce con la denominación estándar FIFA/local
API_NAME_MAPPING: dict[str, str] = {
    "Czechia":          "Czech Republic",
    "USA":              "United States",
    "IR Iran":          "Iran",
    "South Korea":      "Korea Republic",
    "Bosnia & Herzegovina": "Bosnia",
    "DR Congo":         "Congo DR",
    "Cape Verde":       "Cabo Verde",
    "Ivory Coast":      "Cote d'Ivoire",
}


def fetch_team_from_api(team_name: str, key_mgr: KeyManager) -> Optional[dict]:
    data = key_mgr.get(f"{APIFOOTBALL_BASE}/teams", {"name": team_name})
    time.sleep(1.5)
    if data and data.get("response"):
        return data["response"][0]
    return None


def fetch_players_from_api(team_api_id: int, key_mgr: KeyManager) -> list:
    players = []
    page = 1
    while True:
        data = key_mgr.get(
            f"{APIFOOTBALL_BASE}/players",
            {"team": team_api_id, "season": 2024, "page": page},
        )
        time.sleep(1.5)
        if not data or not data.get("response"):
            if page == 1:
                print(f"[DEBUG] Respuesta API completa para team_id={team_api_id} (página 1): {data}")
            break
        players.extend(data["response"])
        paging = data.get("paging", {})
        if page >= paging.get("total", 1):
            break
        page += 1
    return players


def fetch_coach_from_api(team_api_id: int, key_mgr: KeyManager) -> Optional[dict]:
    data = key_mgr.get(f"{APIFOOTBALL_BASE}/coachs", {"team": team_api_id})
    time.sleep(1.5)
    if data and data.get("response"):
        return data["response"][0]
    return None


def fetch_coach_career(coach_api_id: int, key_mgr: KeyManager) -> list:
    data = key_mgr.get(f"{APIFOOTBALL_BASE}/coachs", {"id": coach_api_id})
    time.sleep(1.5)
    if data and data.get("response"):
        return data["response"][0].get("career", [])
    return []


def fetch_h2h(team1_id: int, team2_id: int, key_mgr: KeyManager) -> list:
    data = key_mgr.get(
        f"{APIFOOTBALL_BASE}/fixtures/headtohead",
        {"h2h": f"{team1_id}-{team2_id}", "last": 20},
    )
    time.sleep(1.5)
    return data.get("response", []) if data else []




# ---------------------------------------------------------------------------
# Step 8: Full ETL Orchestrator
# ---------------------------------------------------------------------------

def _player_count_by_team(engine) -> dict[str, int]:
    """
    Query the DB and return {team_name: player_count} for every team
    that already exists in the Teams table.
    """
    from sqlalchemy import text
    with engine.connect() as con:
        rows = con.execute(text(
            """
            SELECT t.name, COUNT(p.id) AS cnt
            FROM Teams t
            LEFT JOIN Players p ON p.team_id = t.id
            GROUP BY t.id, t.name
            """
        )).fetchall()
    return {row[0]: row[1] for row in rows}


def _purge_team_players(session: Session, team_id: int) -> None:
    """
    Full pre-extraction cleanup for team_id:
      Coach_Stats → Coaches → Player_Stats → Players
    Order respects FK dependencies (child rows before parent rows).
    """
    from sqlalchemy import text
    # Coach_Stats must go before Coaches (FK: Coach_Stats.coach_id → Coaches.id)
    session.execute(text(
        "DELETE FROM Coach_Stats WHERE coach_id IN "
        "(SELECT id FROM Coaches WHERE team_id = :tid)"
    ), {"tid": team_id})
    session.execute(text(
        "DELETE FROM Coaches WHERE team_id = :tid"
    ), {"tid": team_id})
    # Player_Stats must go before Players (FK: Player_Stats.player_id → Players.id)
    session.execute(text(
        "DELETE FROM Player_Stats WHERE player_id IN "
        "(SELECT id FROM Players WHERE team_id = :tid)"
    ), {"tid": team_id})
    session.execute(text(
        "DELETE FROM Players WHERE team_id = :tid"
    ), {"tid": team_id})
    session.flush()
    log.info("  Limpieza previa completa (coaches + players) para team_id=%d.", team_id)


def run_etl():
    state   = StateManager()
    engine  = init_db()
    init_cache()
    key_mgr = KeyManager()

    # --- 8a. Load lineups from local JSON ---
    raw_teams = load_local_lineups(state)

    # Build a live player-count map from the DB (source of truth)
    player_counts = _player_count_by_team(engine)

    with Session(engine) as session:

        for raw in raw_teams:
            team_name = raw["team"]

            # --- Validación real contra la BD ---
            db_player_count = player_counts.get(team_name, -1)

            if db_player_count > 0:
                # Team exists in DB AND has players → truly done
                log.info("Equipo ya procesado con datos: %s (%d jugadores). Saltando.",
                         team_name, db_player_count)
                if team_name not in state.state["teams_fetched"]:
                    state.state["teams_fetched"].append(team_name)
                continue

            if db_player_count == 0:
                log.info("[INFO] Equipo %s sin datos de jugadores. Forzando extracción...",
                         team_name)
            else:
                log.info("=== Procesando equipo nuevo: %s ===", team_name)

            # --- 8b. API-Football: team metadata ---
            # Reuse existing Teams row if present, otherwise create it
            from sqlalchemy import text as _text
            existing = session.execute(
                _text("SELECT id, api_football_id FROM Teams WHERE name = :n"),
                {"n": team_name},
            ).fetchone()

            if existing:
                team_row = session.get(Team, existing[0])
                _purge_team_players(session, team_row.id)

                # PARCHE: reparar filas guardadas sin api_football_id (ej. run de Transfermarkt)
                if not team_row.api_football_id:
                    search_name = API_NAME_MAPPING.get(team_name, team_name)
                    if search_name != team_name:
                        log.info("Nombre mapeado para API: '%s' → '%s'", team_name, search_name)
                    api_team = fetch_team_from_api(search_name, key_mgr)
                    if not api_team:
                        raise ValueError(
                            f"No se encontró '{search_name}' en API-Football al reparar "
                            f"'{team_name}'. Verifica el nombre en API_NAME_MAPPING."
                        )
                    team_row.api_football_id = api_team["team"]["id"]
                    team_row.country  = team_row.country  or api_team["team"]["country"]
                    team_row.logo_url = team_row.logo_url or api_team["team"]["logo"]
                    session.flush()
                    log.info("PARCHE: api_football_id=%d asignado a '%s'.",
                             team_row.api_football_id, team_name)
            else:
                search_name = API_NAME_MAPPING.get(team_name, team_name)
                if search_name != team_name:
                    log.info("Nombre mapeado para API: '%s' → '%s'", team_name, search_name)
                api_team = fetch_team_from_api(search_name, key_mgr)
                if not api_team:
                    raise ValueError(
                        f"No se encontró el equipo '{search_name}' en API-Football. "
                        "Verifica el nombre en el diccionario API_NAME_MAPPING."
                    )
                team_row = Team(
                    name           = team_name,
                    api_football_id= api_team["team"]["id"],
                    country        = api_team["team"]["country"],
                    logo_url       = api_team["team"]["logo"],
                    scraped_source = LOCAL_LINEUPS_FILE,
                )
                session.add(team_row)
                session.flush()

            # --- 8c. Coach ---
            existing_coach = session.execute(
                _text("SELECT id FROM Coaches WHERE team_id = :tid"),
                {"tid": team_row.id},
            ).fetchone()

            if existing_coach:
                coach_row = session.get(Coach, existing_coach[0])
            else:
                raw_coach = raw.get("coach")
                api_coach = fetch_coach_from_api(team_row.api_football_id, key_mgr) \
                            if team_row.api_football_id else None
                coach_row = Coach(
                    team_id         = team_row.id,
                    full_name       = (api_coach.get("name") if api_coach else raw_coach) or "Unknown",
                    nationality     = api_coach.get("nationality") if api_coach else None,
                    api_football_id = api_coach.get("id") if api_coach else None,
                )
                session.add(coach_row)
                session.flush()

            # Coach career stats
            career = fetch_coach_career(coach_row.api_football_id, key_mgr) \
                     if coach_row.api_football_id else []
            total_w = total_d = total_l = total_m = 0
            for club_stint in career:
                for fixture_type in club_stint.get("fixtures", {}).values():
                    total_m += fixture_type.get("played", {}).get("total", 0)
                    total_w += fixture_type.get("wins",   {}).get("total", 0)
                    total_d += fixture_type.get("draws",  {}).get("total", 0)
                    total_l += fixture_type.get("loses",  {}).get("total", 0)

            coach_stats = CoachStats(
                coach_id        = coach_row.id,
                career_matches  = total_m,
                career_wins     = total_w,
                career_draws    = total_d,
                career_losses   = total_l,
                win_rate_pct    = round(total_w / total_m * 100, 2) if total_m else None,
            )
            session.add(coach_stats)

            # --- 8d. Players ---
            api_players = fetch_players_from_api(team_row.api_football_id, key_mgr) \
                          if team_row.api_football_id else []

            # Kill switch: detiene el pipeline antes del commit si la API no devuelve jugadores
            if not api_players:
                raise RuntimeError(
                    f"La API devolvió 0 jugadores para '{team_name}'. "
                    "Límite de API agotado o error de red. Abortando."
                )

            # Identify top 3 stars by goals + assists
            def _score(p):
                s = p.get("statistics", [{}])[0]
                return (s.get("goals", {}).get("total") or 0) + \
                       (s.get("goals", {}).get("assists") or 0)

            sorted_players = sorted(api_players, key=_score, reverse=True)
            star_ids = {p["player"]["id"] for p in sorted_players[:3]}

            for ap in api_players:
                pinfo = ap["player"]

                # Pick the primary league stat block (type == "League").
                # Fall back to [0] if none qualifies (cups, friendlies, etc.)
                all_stats = ap.get("statistics", [{}])
                pstat = next(
                    (s for s in all_stats if s.get("league", {}).get("type") == "League"),
                    all_stats[0],
                )

                if pinfo["id"] in state.state["players_fetched"]:
                    continue

                club_name    = pstat.get("team", {}).get("name", "")
                club_country = pstat.get("league", {}).get("country", "")
                league_name  = pstat.get("league", {}).get("name", "")
                is_star      = pinfo["id"] in star_ids
                alt_deltas   = compute_altitude_deltas(club_name, club_country) if club_name else {}

                player_row = Player(
                    team_id         = team_row.id,
                    api_football_id = pinfo["id"],
                    full_name       = pinfo.get("name", "Unknown"),
                    nationality     = pinfo.get("nationality"),
                    age             = pinfo.get("age"),
                    position        = pstat.get("games", {}).get("position"),
                    shirt_number    = pstat.get("games", {}).get("number"),
                    club_name       = club_name,
                    club_country    = club_country,
                    is_star         = is_star,
                    photo_url       = pinfo.get("photo"),
                )
                session.add(player_row)
                session.flush()

                # --- Altitude ---
                if club_name and alt_deltas:
                    player_row.club_altitude_m = (
                        WC2026_VENUES[list(alt_deltas.keys())[0]]["altitude_m"]
                        - list(alt_deltas.values())[0]
                    )

                # --- FBref (stub) ---
                fbref = fetch_fbref_stats(pinfo.get("name", ""), league_name)

                # --- Transfermarkt ---
                tm_data = fetch_transfermarkt_data(pinfo.get("name", ""))
                if tm_data.get("market_value_eur"):
                    player_row.market_value_eur = tm_data["market_value_eur"]

                # --- ClubElo ---
                elo_data = fetch_club_elo(club_name) if club_name else {}

                # --- Player Stats row ---
                games   = pstat.get("games", {})
                goals   = pstat.get("goals", {})
                passes  = pstat.get("passes", {})
                tackles = pstat.get("tackles", {})
                cards   = pstat.get("cards", {})

                alt_vals = list(alt_deltas.values()) if alt_deltas else [0]
                p_stats = PlayerStats(
                    player_id             = player_row.id,
                    season                = "2024/25",
                    appearances           = games.get("appearences") or 0,
                    starts                = games.get("lineups") or 0,
                    minutes_played        = games.get("minutes") or 0,
                    goals                 = goals.get("total") or 0,
                    assists               = goals.get("assists") or 0,
                    shots_total           = fbref.get("shots_total") or 0,
                    shots_on_target       = 0,
                    xg                    = fbref.get("xg") or 0.0,
                    xa                    = fbref.get("xa") or 0.0,
                    passes_total          = passes.get("total") or 0,
                    passes_accuracy_pct   = passes.get("accuracy") or fbref.get("passes_accuracy_pct") or 0.0,
                    key_passes            = passes.get("key") or fbref.get("key_passes") or 0,
                    tackles               = tackles.get("total") or 0,
                    interceptions         = tackles.get("interceptions") or 0,
                    yellow_cards          = cards.get("yellow") or 0,
                    red_cards             = cards.get("red") or 0,
                    injury_days_missed    = tm_data.get("injury_days_missed") or 0,
                    injuries_last_3seasons= tm_data.get("injuries_last_3seasons") or 0,
                    max_altitude_delta_m  = max(alt_vals) if alt_vals else 0.0,
                    min_altitude_delta_m  = min(alt_vals) if alt_vals else 0.0,
                    club_elo_rating       = elo_data.get("club_elo_rating"),
                    league_rank_europe    = elo_data.get("league_rank_europe"),
                )
                session.add(p_stats)

                # --- NewsAPI (solo estrellas) ---
                if is_star:
                    news = fetch_news_sentiment(pinfo.get("name", ""), team_name)
                    ctx = ContextData(
                        team_id                = team_row.id,
                        context_type           = "news",
                        news_sentiment_score   = news.get("news_sentiment_score"),
                        news_articles_analyzed = news.get("news_articles_analyzed"),
                        news_query_player      = news.get("news_query_player"),
                    )
                    session.add(ctx)

                state.state["players_fetched"].append(pinfo["id"])
                time.sleep(0.5)

            # --- Altitude context per venue ---
            for venue, vinfo in WC2026_VENUES.items():
                ctx_alt = ContextData(
                    team_id      = team_row.id,
                    context_type = "altitude",
                    venue_name   = venue,
                    venue_altitude_m = vinfo["altitude_m"],
                )
                session.add(ctx_alt)

            session.commit()
            state.mark("teams_fetched", state.state["teams_fetched"] + [team_name])
            log.info("Equipo %s guardado en BD.", team_name)

    log.info("ETL completado. Base de datos: %s", DB_FILE)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    run_etl()
