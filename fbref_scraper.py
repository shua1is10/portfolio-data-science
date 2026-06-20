# =============================================================================
# MOTOR DE EXTRACCIÓN: fbref.com — Match Logs de Selecciones Nacionales
# -----------------------------------------------------------------------------
# Objetivo : Extraer el historial reciente ("Scores & Fixtures" / Match Logs)
#            de las 48 selecciones del torneo y exportarlo en formato tabular
#            listo para limpieza previa al modelado.
# Entorno  : Diseñado para ejecutarse celda a celda en Jupyter Notebook.
# Variables: Fecha, Oponente, Resultado, GF, GA, Posesión, xG, xGA,
#            Tiros a Puerta (SoT), SCA (Shot-Creating Actions).
# =============================================================================

# %% ── CELDA 1: Imports y configuración global ────────────────────────────────
import asyncio
import random
from io import StringIO

import nodriver as uc
import pandas as pd
from bs4 import BeautifulSoup, Comment

BASE_URL = "https://fbref.com"

# Pausa defensiva entre requests (segundos). fbref permite ~10 req/min;
# usamos un rango aleatorio 4-7 s para quedar muy por debajo del límite.
SLEEP_MIN, SLEEP_MAX = 4.0, 7.0

# Reintentos ante challenge de Cloudflare / errores de red
MAX_RETRIES = 3

# Tiempo de espera tras navegar para que Cloudflare resuelva el challenge JS
CHALLENGE_WAIT = 15.0
CLOUDFLARE_MARKERS = ("Just a moment", "Un momento")

# Timeout duro por operación de navegador, para no bloquear el pipeline
# indefinidamente si una pestaña deja de responder.
NAV_TIMEOUT = 60.0

# Grupos del Mundial 2026 (debe coincidir con generar_matriz.py)
GRUPOS_MUNDIAL = {
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
GROUP_LOOKUP = {team: f"Group {g}" for g, teams in GRUPOS_MUNDIAL.items() for team in teams}

# Nombres derivados del slug de fbref que no coinciden literalmente con
# GRUPOS_MUNDIAL -> nombre canónico del dataset maestro.
NAME_ALIASES = {
    "Korea Republic": "South Korea",
    "Bosnia and Herzegovina": "Bosnia & Herzegovina",
    "Cote dIvoire": "Ivory Coast",
    "Curacao": "Curaçao",
    "Congo DR": "DR Congo",
    "IR Iran": "Iran",
    "Turkiye": "Turkey",
}

# URLs estables de las páginas "Stats" (squad) de las 48 selecciones del
# Mundial 2026 en fbref. La URL del match log se deriva de cada una.
TEAM_URLS = [
    "https://fbref.com/en/squads/b009a548/Mexico-Men-Stats",
    "https://fbref.com/en/squads/506f1741/South-Africa-Men-Stats",
    "https://fbref.com/en/squads/473f0fbf/Korea-Republic-Men-Stats",
    "https://fbref.com/en/squads/2740937c/Czechia-Men-Stats",
    "https://fbref.com/en/squads/9c6d90a0/Canada-Men-Stats",
    "https://fbref.com/en/squads/6c5ef1c3/Bosnia-and-Herzegovina-Men-Stats",
    "https://fbref.com/en/squads/9b696ed1/Qatar-Men-Stats",
    "https://fbref.com/en/squads/81021a70/Switzerland-Men-Stats",
    "https://fbref.com/en/squads/304635c3/Brazil-Men-Stats",
    "https://fbref.com/en/squads/af41ccda/Morocco-Men-Stats",
    "https://fbref.com/en/squads/61828292/Haiti-Men-Stats",
    "https://fbref.com/en/squads/602d3994/Scotland-Men-Stats",
    "https://fbref.com/en/squads/0f66725b/United-States-Men-Stats",
    "https://fbref.com/en/squads/d2043442/Paraguay-Men-Stats",
    "https://fbref.com/en/squads/b90bf4f9/Australia-Men-Stats",
    "https://fbref.com/en/squads/ac6bcf92/Turkiye-Men-Stats",
    "https://fbref.com/en/squads/c1e40422/Germany-Men-Stats",
    "https://fbref.com/en/squads/e0f5893a/Curacao-Men-Stats",
    "https://fbref.com/en/squads/24772b12/Cote-dIvoire-Men-Stats",
    "https://fbref.com/en/squads/123acaf8/Ecuador-Men-Stats",
    "https://fbref.com/en/squads/5bb5024a/Netherlands-Men-Stats",
    "https://fbref.com/en/squads/ffcf1690/Japan-Men-Stats",
    "https://fbref.com/en/squads/296f69e7/Sweden-Men-Stats",
    "https://fbref.com/en/squads/a7c7562a/Tunisia-Men-Stats",
    "https://fbref.com/en/squads/361422b9/Belgium-Men-Stats",
    "https://fbref.com/en/squads/b8889750/Egypt-Men-Stats",
    "https://fbref.com/en/squads/6a08f71e/IR-Iran-Men-Stats",
    "https://fbref.com/en/squads/259855f0/New-Zealand-Men-Stats",
    "https://fbref.com/en/squads/b561dd30/Spain-Men-Stats",
    "https://fbref.com/en/squads/31fa6fa6/Cape-Verde-Men-Stats",
    "https://fbref.com/en/squads/6e84edac/Saudi-Arabia-Men-Stats",
    "https://fbref.com/en/squads/870e020f/Uruguay-Men-Stats",
    "https://fbref.com/en/squads/b1b36dcd/France-Men-Stats",
    "https://fbref.com/en/squads/9ab5c684/Senegal-Men-Stats",
    "https://fbref.com/en/squads/ec843efd/Iraq-Men-Stats",
    "https://fbref.com/en/squads/599eba19/Norway-Men-Stats",
    "https://fbref.com/en/squads/f9fddd6e/Argentina-Men-Stats",
    "https://fbref.com/en/squads/1e2dba57/Algeria-Men-Stats",
    "https://fbref.com/en/squads/d5121f10/Austria-Men-Stats",
    "https://fbref.com/en/squads/3e22f0fa/Jordan-Men-Stats",
    "https://fbref.com/en/squads/4a1b4ea8/Portugal-Men-Stats",
    "https://fbref.com/en/squads/9be9f315/Congo-DR-Men-Stats",
    "https://fbref.com/en/squads/cd389e75/Uzbekistan-Men-Stats",
    "https://fbref.com/en/squads/ab73cfe5/Colombia-Men-Stats",
    "https://fbref.com/en/squads/1862c019/England-Men-Stats",
    "https://fbref.com/en/squads/7b08e376/Croatia-Men-Stats",
    "https://fbref.com/en/squads/9349828d/Ghana-Men-Stats",
    "https://fbref.com/en/squads/6061a82d/Panama-Men-Stats",
]


# %% ── CELDA 2: Capa de peticiones defensiva ─────────────────────────────────
async def polite_get(url: str, tab: uc.Tab) -> str | None:
    """
    GET defensivo contra fbref usando un navegador real (nodriver), necesario
    porque fbref sirve un challenge JS de Cloudflare ("Just a moment...") que
    requests/cloudscraper no pueden resolver.
      - asyncio.sleep() aleatorio (4-7 s) ANTES de cada navegación.
      - Tras navegar, espera CHALLENGE_WAIT s para que Cloudflare resuelva
        el challenge automáticamente.
      - Reintenta si el HTML devuelto sigue siendo la página de challenge.
      - try/except para errores de red; devuelve None si agota los
        reintentos (el pipeline continúa con el siguiente equipo).
    """
    for attempt in range(1, MAX_RETRIES + 1):
        await asyncio.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))
        try:
            await asyncio.wait_for(tab.get(url), timeout=NAV_TIMEOUT)
            await asyncio.sleep(CHALLENGE_WAIT)
            html = await asyncio.wait_for(tab.get_content(), timeout=NAV_TIMEOUT)
            if not any(marker in html[:1000] for marker in CLOUDFLARE_MARKERS):
                return html
            print(f"  [Cloudflare] Challenge persistente (intento {attempt}/{MAX_RETRIES})...", flush=True)
            await asyncio.sleep(15 * attempt)
        except Exception as exc:
            print(f"  [Red] Intento {attempt}/{MAX_RETRIES} falló: {exc}", flush=True)
            await asyncio.sleep(10 * attempt)
    return None


def extract_table(soup: BeautifulSoup, table_id_substring: str) -> pd.DataFrame | None:
    """
    fbref envuelve muchas tablas dentro de comentarios HTML (<!-- ... -->)
    para lazy-loading. Esta función busca la tabla tanto en el DOM visible
    como dentro de los comentarios, y la parsea con pandas.read_html.
    """
    # 1) DOM visible
    table = soup.find("table", id=lambda x: x and table_id_substring in x)
    if table is not None:
        return pd.read_html(StringIO(str(table)))[0]

    # 2) Tablas comentadas
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        if table_id_substring in comment:
            inner = BeautifulSoup(comment, "lxml")
            table = inner.find("table", id=lambda x: x and table_id_substring in x)
            if table is not None:
                return pd.read_html(StringIO(str(table)))[0]
    return None


# %% ── CELDA 3: De la URL del squad al match log ────────────────────────────
def team_name_from_url(squad_url: str) -> str:
    """
    Deriva el nombre de la selección a partir del slug de la URL:
      .../Korea-Republic-Men-Stats -> "Korea Republic" -> "South Korea"
    Aplica NAME_ALIASES para alinear con los nombres de GRUPOS_MUNDIAL.
    """
    slug = squad_url.rstrip("/").split("/")[-1]
    name = slug.replace("-Men-Stats", "").replace("-", " ")
    return NAME_ALIASES.get(name, name)


def matchlog_url_from_squad(squad_url: str) -> str:
    """
    Convierte la URL del squad en la URL de 'Scores & Fixtures' (match log).
      .../squads/{id}/{Slug}-Men-Stats
      -> .../squads/{id}/matchlogs/all_comps/schedule/{Slug}-Men-Scores-and-Fixtures
    """
    parts = squad_url.rstrip("/").split("/")
    team_id = parts[parts.index("squads") + 1]
    slug = parts[-1].replace("-Stats", "")
    return (f"{BASE_URL}/en/squads/{team_id}/matchlogs/all_comps/schedule/"
            f"{slug}-Scores-and-Fixtures")


# %% ── CELDA 4: Parser del Match Log -> variables predictivas ────────────────
# Columnas crudas de fbref -> nombres del dataset final
COLUMN_MAP = {
    "Date": "fecha",
    "Opponent": "oponente",
    "Result": "resultado",
    "GF": "goles_favor",
    "GA": "goles_contra",
    "Poss": "posesion",
    "xG": "xg",
    "xGA": "xga",
    "SoT": "tiros_puerta",   # presente si el log incluye shooting stats
    "SCA": "sca",            # presente si el log incluye GCA/SCA stats
}

TARGET_COLS = ["equipo", "grupo", "fecha", "oponente", "resultado",
               "goles_favor", "goles_contra", "posesion", "xg", "xga",
               "tiros_puerta", "sca"]


def parse_matchlog(df_raw: pd.DataFrame, team: str, group: str) -> pd.DataFrame:
    """
    Normaliza la tabla 'Scores & Fixtures' de fbref:
      - Aplana MultiIndex de columnas si existe.
      - Renombra a esquema en español.
      - Garantiza la presencia de TODAS las columnas objetivo (NaN si la
        métrica no está disponible para esa selección, p. ej. SoT/SCA).
      - Filtra filas basura (separadores repetidos del header).
    """
    df = df_raw.copy()

    # Aplanar MultiIndex ('For Team', 'xG') -> 'xG'
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[-1] for c in df.columns]

    # Eliminar filas que repiten el encabezado dentro del cuerpo
    if "Date" in df.columns:
        df = df[df["Date"].notna() & (df["Date"] != "Date")]

    df = df.rename(columns=COLUMN_MAP)
    df["equipo"] = team
    df["grupo"] = group

    for col in TARGET_COLS:
        if col not in df.columns:
            df[col] = pd.NA

    df = df[TARGET_COLS]

    # Tipificación numérica (errores -> NaN, se resuelven en limpieza)
    for col in ["goles_favor", "goles_contra", "posesion", "xg", "xga",
                "tiros_puerta", "sca"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")

    return df.dropna(subset=["fecha"]).reset_index(drop=True)


async def scrape_team(squad_url: str, tab: uc.Tab) -> pd.DataFrame | None:
    """Pipeline completo para una selección: URL del squad -> match log -> DataFrame."""
    team = team_name_from_url(squad_url)
    group = GROUP_LOOKUP.get(team, "")
    print(f">> {group} | {team}", flush=True)

    log_url = matchlog_url_from_squad(squad_url)
    html = await polite_get(log_url, tab)
    if html is None:
        return None

    soup = BeautifulSoup(html, "lxml")
    df_raw = extract_table(soup, "matchlogs")
    if df_raw is None:
        print(f"  [Parser] Tabla de matchlogs no encontrada para {team}", flush=True)
        return None

    df = parse_matchlog(df_raw, team, group)
    print(f"  OK {len(df)} partidos extraidos", flush=True)
    return df


# %% ── CELDA 5: Orquestador principal ────────────────────────────────────────
async def run_pipeline(output_csv: str = "fbref_matchlogs.csv") -> pd.DataFrame:
    """
    Recorre TEAM_URLS, scrapea cada selección y consolida todo en un único
    DataFrame/CSV listo para limpieza.
    Checkpointing: guarda el CSV parcial tras cada equipo, de modo que un
    bloqueo a mitad de corrida no pierde el progreso acumulado.
    """
    browser = await uc.start(headless=False)  # navegador real reduce challenges
    tab = browser.main_tab

    frames: list[pd.DataFrame] = []
    failed: list[str] = []

    try:
        for squad_url in TEAM_URLS:
            team = team_name_from_url(squad_url)
            try:
                df = await scrape_team(squad_url, tab)
                if df is not None and not df.empty:
                    frames.append(df)
                    # Checkpoint incremental
                    pd.concat(frames, ignore_index=True).to_csv(
                        output_csv, index=False, encoding="utf-8-sig")
                else:
                    failed.append(team)
            except Exception as exc:  # nunca abortar la corrida completa
                print(f"  [ERROR inesperado] {team}: {exc}", flush=True)
                failed.append(team)
    finally:
        browser.stop()

    result = (pd.concat(frames, ignore_index=True)
              if frames else pd.DataFrame(columns=TARGET_COLS))
    result.to_csv(output_csv, index=False, encoding="utf-8-sig")

    print("\n" + "=" * 60, flush=True)
    print(f"Pipeline finalizado: {len(result)} filas | {len(frames)} equipos OK", flush=True)
    if failed:
        print(f"Equipos fallidos/reintentar: {failed}", flush=True)
    print(f"Salida tabular: {output_csv}", flush=True)
    return result


# %% ── CELDA 6: Ejecución ────────────────────────────────────────────────────
if __name__ == "__main__":
    df_matchlogs = asyncio.run(run_pipeline())
    # Vista previa en Jupyter:
    # df_matchlogs.head(20)
