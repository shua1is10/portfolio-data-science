print("""
==============================================================
   ESQUEMA DE BASE DE DATOS  -  mundial2026.db
==============================================================

TABLA: Teams
  id               INTEGER  PK autoincrement
  api_football_id  INTEGER  UNIQUE  (ID en API-Football)
  name             TEXT     NOT NULL (nombre del seleccionado)
  fifa_code        TEXT     (codigo FIFA de 3 letras)
  confederation    TEXT     (UEFA / CONMEBOL / CAF / AFC / CONCACAF / OFC)
  group_letter     TEXT     (grupo A-L del sorteo)
  country          TEXT
  logo_url         TEXT
  ranking_fifa     INTEGER  (posicion en ranking FIFA)
  scraped_source   TEXT     (URL de origen del scraping)
  created_at       DATETIME

TABLA: Coaches
  id               INTEGER  PK
  team_id          INTEGER  FK -> Teams.id
  api_football_id  INTEGER  UNIQUE
  full_name        TEXT     NOT NULL
  nationality      TEXT
  birth_date       DATE
  age              INTEGER
  photo_url        TEXT
  created_at       DATETIME

TABLA: Players
  id               INTEGER  PK
  team_id          INTEGER  FK -> Teams.id
  api_football_id  INTEGER  UNIQUE
  full_name        TEXT     NOT NULL
  nationality      TEXT
  birth_date       DATE
  age              INTEGER
  position         TEXT     (GK / DF / MF / FW)
  shirt_number     INTEGER
  club_name        TEXT
  club_city        TEXT
  club_country     TEXT
  club_latitude    FLOAT
  club_longitude   FLOAT
  club_altitude_m  FLOAT    (metros - altitud ciudad del club)
  market_value_eur FLOAT    (valor Transfermarkt, EUR)
  is_star          BOOLEAN  (TRUE = top-3 estrella del equipo)
  photo_url        TEXT
  created_at       DATETIME

TABLA: Player_Stats  (temporada 2024/25 - una fila por jugador)
  id                       INTEGER  PK
  player_id                INTEGER  FK -> Players.id  UNIQUE
  season                   TEXT     (ej: 2024/25)
  appearances              INTEGER
  starts                   INTEGER
  minutes_played           INTEGER
  goals                    INTEGER
  assists                  INTEGER
  shots_total              INTEGER  (FBref via lanusStats)
  shots_on_target          INTEGER
  xg                       FLOAT    (Expected Goals - FBref/lanusStats)
  xa                       FLOAT    (Expected Assists - FBref/lanusStats)
  passes_total             INTEGER
  passes_accuracy_pct      FLOAT
  key_passes               INTEGER  (FBref via lanusStats)
  tackles                  INTEGER
  interceptions            INTEGER
  duels_won_pct            FLOAT
  yellow_cards             INTEGER
  red_cards                INTEGER
  injury_days_missed       INTEGER  (historial total - Transfermarkt)
  injuries_last_3seasons   INTEGER  (temporadas 22/23, 23/24, 24/25)
  max_altitude_delta_m     FLOAT    (max: altitud_sede - altitud_club)
  min_altitude_delta_m     FLOAT    (min: altitud_sede - altitud_club)
  intl_caps                INTEGER
  intl_goals               INTEGER
  club_elo_rating          FLOAT    (ClubElo.API - rating ELO del club)
  league_rank_europe       INTEGER  (1=elite Champions, 5=ligas bajas)
  updated_at               DATETIME

TABLA: Coach_Stats  (una fila por DT)
  id                       INTEGER  PK
  coach_id                 INTEGER  FK -> Coaches.id  UNIQUE
  career_matches           INTEGER  (partidos totales en carrera)
  career_wins              INTEGER
  career_draws             INTEGER
  career_losses            INTEGER
  win_rate_pct             FLOAT    (% victorias carrera total)
  intl_matches             INTEGER  (partidos con la seleccion)
  intl_wins                INTEGER
  intl_draws               INTEGER
  intl_losses              INTEGER
  intl_win_rate_pct        FLOAT
  wc_qualifiers_played     INTEGER  (partidos de eliminatorias)
  wc_finals_appearances    INTEGER  (mundiales como DT)
  preferred_formation      TEXT     (ej: 4-3-3)
  press_intensity_score    FLOAT    (PPDA/pressing stats, FBref)
  updated_at               DATETIME

TABLA: Context_Data  (senales contextuales externas)
  id                        INTEGER  PK
  team_id                   INTEGER  FK -> Teams.id
  context_type              TEXT     (news | altitude | h2h | group)
  news_sentiment_score      FLOAT    (-1 negativo ... +1 positivo)
  news_articles_analyzed    INTEGER
  news_query_player         TEXT     (estrella consultada, NewsAPI)
  venue_name                TEXT     (ej: Mexico City)
  venue_altitude_m          FLOAT    (altitud oficial de la sede)
  squad_avg_club_altitude_m FLOAT    (promedio altitud clubes del plantel)
  altitude_advantage_score  FLOAT    (diferencial normalizado)
  opponent_team_id          INTEGER  FK -> Teams.id  NULLABLE  (para h2h)
  h2h_matches               INTEGER
  h2h_wins                  INTEGER
  h2h_draws                 INTEGER
  h2h_losses                INTEGER
  raw_json                  TEXT     (JSON blob extensible)
  fetched_at                DATETIME
  UNIQUE(team_id, context_type, venue_name, opponent_team_id)

==============================================================
   AVISO: RELLENA TUS CLAVES EN .env ANTES DE EJECUTAR
==============================================================

  El archivo .env ya existe con las claves que proporcionaste.
  Si deseas renovarlas o cambiarlas, edita .env y actualiza:

    RAPIDAPI_KEYS  -> tus keys de rapidapi.com  (API-Football v3)
    NEWSAPI_KEY    -> tu key de newsapi.org

  Instala las 3 librerias opcionales (con el venv activo):
    .\\venv\\Scripts\\pip install lanusStats
    .\\venv\\Scripts\\pip install transfermarkt-api
    (ClubElo.API es REST publico, sin pip adicional)

  Cuando todo este listo, ejecuta manualmente:
    .\\venv\\Scripts\\python etl_mundial.py

==============================================================
""")
