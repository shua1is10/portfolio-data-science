"""
generar_matriz.py
Genera la Feature Matrix de partidos de fase de grupos para el Mundial 2026.
Fuente: mundial2026.db  |  Salida: matriz_partidos.csv
"""

import sqlite3
import itertools
import pandas as pd

DB_FILE  = "mundial2026.db"
OUT_FILE = "matriz_partidos.csv"

# ---------------------------------------------------------------------------
# 1. Diccionario de Grupos
# ---------------------------------------------------------------------------
grupos_mundial = {
    "A": ["Mexico", "South Africa", "South Korea", "Czechia"],
    "B": ["Canada", "Bosnia & Herzegovina", "Qatar", "Switzerland"],
    "C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "D": ["United States", "Paraguay", "Australia", "Turkey"],
    "E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "I": ["France", "Senegal", "Iraq", "Norway"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
}

# ---------------------------------------------------------------------------
# 2. Agregación — Poder de Equipo
# ---------------------------------------------------------------------------
QUERY = """
SELECT
    t.name          AS team_name,
    -- Ofensivas (suma)
    COALESCE(ps.goals,        0) AS goals,
    COALESCE(ps.assists,      0) AS assists,
    COALESCE(ps.shots_total,  0) AS shots_total,
    COALESCE(ps.xg,           0) AS xg,
    COALESCE(ps.xa,           0) AS xa,
    -- Calidad (promedio)
    COALESCE(ps.passes_accuracy_pct, 0) AS passes_accuracy_pct,
    COALESCE(ps.duels_won_pct,       0) AS duels_won_pct,
    COALESCE(ps.minutes_played,      0) AS minutes_played,
    COALESCE(ps.club_elo_rating,     0) AS club_elo_rating,
    -- Defensivas
    COALESCE(ps.tackles,       0) AS tackles,
    COALESCE(ps.interceptions, 0) AS interceptions,
    -- Disciplina
    COALESCE(ps.yellow_cards,  0) AS yellow_cards,
    COALESCE(ps.red_cards,     0) AS red_cards,
    -- Lesiones / disponibilidad
    COALESCE(ps.injury_days_missed,     0) AS injury_days_missed,
    COALESCE(ps.injuries_last_3seasons, 0) AS injuries_last_3seasons,
    -- Altitud
    COALESCE(ps.max_altitude_delta_m,   0) AS max_altitude_delta_m,
    COALESCE(ps.min_altitude_delta_m,   0) AS min_altitude_delta_m,
    -- Internacional
    COALESCE(ps.intl_caps,   0) AS intl_caps,
    COALESCE(ps.intl_goals,  0) AS intl_goals
FROM Teams t
JOIN Players   p  ON p.team_id   = t.id
JOIN Player_Stats ps ON ps.player_id = p.id
"""

def build_team_power(db_path: str) -> pd.DataFrame:
    con = sqlite3.connect(db_path)
    raw = pd.read_sql_query(QUERY, con)
    con.close()

    # Rellenar nulos residuales con 0 / media según tipo
    numeric_cols = raw.select_dtypes(include="number").columns.tolist()
    raw[numeric_cols] = raw[numeric_cols].fillna(0)

    # Columnas que se suman (representan producción ofensiva acumulada)
    sum_cols = [
        "goals", "assists", "shots_total", "xg", "xa",
        "tackles", "interceptions",
        "yellow_cards", "red_cards",
        "injury_days_missed", "injuries_last_3seasons",
        "intl_caps", "intl_goals",
    ]
    # Columnas que se promedian (representan calidad / niveles)
    mean_cols = [
        "passes_accuracy_pct", "duels_won_pct",
        "minutes_played", "club_elo_rating",
        "max_altitude_delta_m", "min_altitude_delta_m",
    ]

    agg_dict = {c: "sum"  for c in sum_cols}
    agg_dict.update({c: "mean" for c in mean_cols})

    team_power = (
        raw.groupby("team_name", as_index=False)
           .agg(agg_dict)
    )

    # Rellenar medias que sigan siendo 0 con la media global del equipo
    for col in mean_cols:
        col_mean = team_power[col].replace(0, pd.NA).mean()
        team_power[col] = team_power[col].fillna(col_mean).fillna(0)

    return team_power


# ---------------------------------------------------------------------------
# 3. Generación de Partidos (6 por grupo × 12 grupos = 72 partidos)
# ---------------------------------------------------------------------------
def generate_fixtures(grupos: dict) -> pd.DataFrame:
    rows = []
    for grupo, equipos in grupos.items():
        for team_a, team_b in itertools.combinations(equipos, 2):
            rows.append({"grupo": grupo, "team_a": team_a, "team_b": team_b})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 4. Cálculo de Diferenciales (Deltas)
# ---------------------------------------------------------------------------
DELTA_COLS = [
    "goals", "assists", "shots_total", "xg", "xa",
    "tackles", "interceptions",
    "yellow_cards", "red_cards",
    "injury_days_missed", "injuries_last_3seasons",
    "passes_accuracy_pct", "duels_won_pct",
    "minutes_played", "club_elo_rating",
    "max_altitude_delta_m", "min_altitude_delta_m",
    "intl_caps", "intl_goals",
]


def build_match_matrix(fixtures: pd.DataFrame, team_power: pd.DataFrame) -> pd.DataFrame:
    # Merge Equipo A
    df = fixtures.merge(
        team_power.add_suffix("_a").rename(columns={"team_name_a": "team_a"}),
        on="team_a",
        how="left",
    )
    # Merge Equipo B
    df = df.merge(
        team_power.add_suffix("_b").rename(columns={"team_name_b": "team_b"}),
        on="team_b",
        how="left",
    )

    # Deltas: A − B para cada variable
    for col in DELTA_COLS:
        col_a = f"{col}_a"
        col_b = f"{col}_b"
        if col_a in df.columns and col_b in df.columns:
            df[f"delta_{col}"] = df[col_a].fillna(0) - df[col_b].fillna(0)

    # Columnas finales ordenadas
    id_cols    = ["grupo", "team_a", "team_b"]
    raw_a_cols = [f"{c}_a" for c in DELTA_COLS if f"{c}_a" in df.columns]
    raw_b_cols = [f"{c}_b" for c in DELTA_COLS if f"{c}_b" in df.columns]
    delta_cols = [f"delta_{c}" for c in DELTA_COLS if f"delta_{c}" in df.columns]

    return df[id_cols + raw_a_cols + raw_b_cols + delta_cols]


# ---------------------------------------------------------------------------
# 5. Upsert — preserva valores históricos donde el nuevo run devuelve 0
# ---------------------------------------------------------------------------
INDEX_COLS = ["grupo", "team_a", "team_b"]


def upsert_csv(df_new: pd.DataFrame, path: str) -> pd.DataFrame:
    """
    Combina df_new con el CSV existente (si lo hay).
    Regla: df_new es la fuente de verdad, pero donde una celda numérica
    vale exactamente 0 y el histórico tenía un valor distinto de 0,
    se rescata el valor histórico.
    Devuelve el DataFrame final ya combinado.
    """
    import os

    if not os.path.exists(path):
        df_new.to_csv(path, index=False, encoding="utf-8-sig")
        print(f"  CSV creado desde cero: {path}")
        return df_new

    df_old = pd.read_csv(path, encoding="utf-8-sig")

    # Alinear columnas: añadir al viejo las columnas nuevas que falten (con 0)
    for col in df_new.columns:
        if col not in df_old.columns:
            df_old[col] = 0

    # Establecer multi-índice en ambos DataFrames
    df_new_idx = df_new.set_index(INDEX_COLS)
    df_old_idx = df_old.set_index(INDEX_COLS).reindex(df_new_idx.index)

    # Operar solo sobre columnas numéricas
    num_cols = df_new_idx.select_dtypes(include="number").columns.tolist()

    # Máscara: celdas del nuevo que valen exactamente 0
    mask_zero = df_new_idx[num_cols] == 0

    # Valor histórico en esas mismas celdas (NaN si la fila no existía antes)
    old_vals = df_old_idx[num_cols].reindex(df_new_idx.index)

    # Rescatar: si nuevo==0 Y histórico!=0 (y no es NaN), usar histórico
    rescue_mask = mask_zero & old_vals.notna() & (old_vals != 0)
    rescued_cells = int(rescue_mask.sum().sum())

    df_merged = df_new_idx.copy()
    df_merged[num_cols] = df_new_idx[num_cols].where(~rescue_mask, other=old_vals)

    result = df_merged.reset_index()

    # Reordenar columnas al orden original de df_new
    result = result[df_new.columns]

    result.to_csv(path, index=False, encoding="utf-8-sig")

    print(f"  CSV actualizado rescatando valores históricos.")
    print(f"  Celdas rescatadas del histórico: {rescued_cells}")
    return result


# ---------------------------------------------------------------------------
# 6. Punto de entrada
# ---------------------------------------------------------------------------
def main():
    print("Conectando a la base de datos:", DB_FILE)
    team_power = build_team_power(DB_FILE)
    print(f"  Equipos con datos en BD: {len(team_power)}")

    fixtures = generate_fixtures(grupos_mundial)
    print(f"  Partidos generados: {len(fixtures)}  "
          f"({len(grupos_mundial)} grupos × 6 combinaciones)")

    matrix = build_match_matrix(fixtures, team_power)

    final = upsert_csv(matrix, OUT_FILE)

    print("\n--- Feature Matrix exportada ---")
    print(f"  Archivo : {OUT_FILE}")
    print(f"  Forma   : {final.shape[0]} filas × {final.shape[1]} columnas")
    print(f"  Grupos  : {sorted(final['grupo'].unique().tolist())}")
    print(f"\nColumnas ({final.shape[1]}):")
    for col in final.columns:
        print(f"  {col}")

    # Equipos del fixture que no tienen datos en la BD
    all_teams = set(final["team_a"]).union(final["team_b"])
    missing   = all_teams - set(team_power["team_name"])
    if missing:
        print(f"\nEquipos sin datos en BD (deltas serán 0): {sorted(missing)}")
    else:
        print("\nTodos los equipos tienen datos en la BD.")


if __name__ == "__main__":
    main()
