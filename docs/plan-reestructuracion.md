# Plan de reestructuración del repositorio

**Stack detectado:** Next.js 14 (App Router) + TypeScript + Tailwind + Recharts, con **pipelines en Python** (pandas, SQLite, joblib) que generan los datos de los dashboards.

---

## 1. Diagnóstico

**El problema principal:** la raíz mezcla tres cosas. Está la app web, el pipeline de ML del Mundial (scripts, notebooks, modelo, datos crudos, 28 MB de PDFs) y archivos sueltos de la versión anterior del sitio. Además, la app web y el pipeline Python se comunican **por rutas implícitas relativas a la raíz**:

- `motor_predictivo_2026.py` escribe `tracking_predicciones_2026.csv`, `live_form_index.json` y `knockout_bracket.json` en el directorio desde el que lo ejecutas (CWD).
- `app/projects/football-predictive-engine/dashboard/page.tsx:91` los lee desde `process.cwd()`, es decir, desde la raíz del repo.

Por eso hoy todo funciona solo porque ambos coinciden en la raíz. Si mueves cualquiera de los dos lados sin cambiar código, el dashboard del Mundial se rompe.

| Archivo / carpeta | Problema |
|---|---|
| `__pycache__/*.pyc`, `tsconfig.tsbuildinfo` | Artefactos de compilación **commiteados** (el `.pyc` está aunque `.gitignore` lo excluye; se añadió antes de la regla). |
| `debug.html` (392 KB) | Copia guardada de una página de FBref, con Google Analytics y Osano incluidos. Nada la referencia. Es contenido de terceros en un repo de portafolio. |
| `index.html`, `resume.html` | Versión estática anterior del sitio. **Next.js no las sirve** (solo sirve `app/` y `public/`), así que hoy no están publicadas. |
| `design-system.json` | Documentación de tokens. Solo la menciona un comentario de `index.html`. |
| `world_cup_master_dataset.json` | **Huérfano**: ningún script lo produce ni lo consume. |
| `analisis_partido.md` | Es un prompt de LLM para generar `ai_match_insights.json`, no documentación del sitio. |
| `match_reports/` | 28 MB de PDFs en git. También hay **IDs duplicados**: `J1-B-1`, `J1-C-1` y `J1-D-1` aparecen dos veces cada uno, y los nombres son inconsistentes (`Marocco`/`Morocco`, `Brasil`/`Brazil`, `Czechia`/`CzechRepublic`, `Iran_vs_New_Zealand` con guion bajo). No los renombres en esta migración, pero conviene corregirlo. |
| `proyecto-adiccion/` | Nombre en español, a diferencia del resto. Además `analysis.py` escribe en `public/` saltando con `..`. |
| `public/data_insights.json` | Se lee con `fs` en el servidor, así que no necesita ser público. Hoy cualquiera puede descargarlo en `/data_insights.json`. |
| `public/data/*` | Sin separar por proyecto. Con un quinto dashboard se volverá confuso. |
| `components/` | Mezcla piezas de layout (navbar, footer, providers) con secciones del home. |

**Lo que está bien y no se mueve:** los dashboards en el mismo directorio que su ruta (`app/projects/<proyecto>/dashboard.tsx`) siguen el patrón recomendado del App Router. También están bien `components/ui/` (estilo shadcn) y `lib/utils.ts`.

---

## 2. Estructura propuesta

```
.
├── app/                              # SOLO rutas (sin cambios internos)
│   ├── layout.tsx · page.tsx · globals.css
│   ├── services/page.tsx
│   └── projects/
│       ├── page.tsx
│       ├── football-predictive-engine/  (page.tsx, dashboard/…)
│       ├── digital-addiction-forecasting/
│       ├── dynamic-pricing/
│       └── web-analytics/
├── components/
│   ├── ui/                           # primitivas (sin cambios)
│   ├── layout/                       # navbar, footer, providers
│   └── sections/                     # hero, skills, contact
├── lib/utils.ts
│
├── data/                             # datos que la web lee en el servidor (fs), NO públicos
│   ├── football/                     # ai_match_insights, player_spotlight, knockout_bracket,
│   │                                 # live_form_index, tracking_predicciones_2026.csv
│   └── digital-addiction/            # data_insights.json
├── public/
│   └── data/                         # datos que el navegador descarga (fetch), uno por proyecto
│       ├── dynamic-pricing/
│       └── web-analytics/
│
├── analytics/                        # todo lo Python, aislado de Next
│   ├── requirements.txt
│   ├── football-wc2026/
│   │   ├── scripts/                  # etl_mundial, fbref_scraper, generar_matriz, motor_predictivo_2026, print_schema, paths.py
│   │   ├── notebooks/                # concatenar, visual
│   │   ├── data/raw/                 # equipos_mundial.json, fbref_matchlogs.csv
│   │   ├── data/processed/           # world_cup_ml_dataset.csv, matriz_partidos.csv, world_cup_master_dataset.json
│   │   ├── models/                   # modelo_wc2026.joblib
│   │   ├── match_reports/            # PDFs
│   │   ├── prompts/                  # analisis_partido.md
│   │   └── .local/                   # (ignorado) mundial2026.db, estado.json, http_cache.sqlite
│   └── digital-addiction/
│       ├── analysis.py
│       └── data/raw/*.csv
│
└── docs/
    ├── design-system.json
    └── legacy/                       # index.html, resume.html
```

**Por qué escala mejor, sobre todo para el próximo proyecto con dashboards:**

- **Una sola regla para los datos.** Cada pipeline escribe en `data/<proyecto>/` si la página lo lee en el servidor, o en `public/data/<proyecto>/` si el navegador lo descarga con `fetch`. Así no dependes del CWD y queda claro qué es público.
- **Un proyecto nuevo es copiar un patrón.** Creas `analytics/<nuevo>/` para el pipeline, `data/<nuevo>/` para su salida y `app/projects/<nuevo>/{page,dashboard}.tsx` para la vista. No hace falta tocar nada más.
- **Python y Node separados.** Next no recorre notebooks ni PDFs, la raíz queda solo con configuración, y más adelante podrías llevar `analytics/` a otro repo o a un job de CI sin tocar la web.
- `tailwind.config.ts` ya cubre `components/**` y `app/**`, así que las subcarpetas nuevas no requieren cambios en esa configuración.

---

## 3. Plan de migración

Hazlo en una rama y **haz un commit por fase**, verificando cada una, para que cualquier error se revierta con un solo `git revert`.

```bash
git switch -c refactor/repo-structure
```

### Fase 0: limpieza segura (no borra nada del disco)

`git rm --cached` solo deja de rastrear el archivo; el archivo sigue en tu disco.

```bash
git rm --cached __pycache__/motor_predictivo_2026.cpython-314.pyc tsconfig.tsbuildinfo
printf "\n# Build artifacts\ntsconfig.tsbuildinfo\n.local/\n" >> .gitignore
```

### Fase 1: pipelines de Python → `analytics/`

```bash
mkdir -p analytics/football-wc2026/{scripts,notebooks,data/raw,data/processed,models,prompts,.local} analytics/digital-addiction/data/raw
git mv requirements.txt analytics/requirements.txt
git mv etl_mundial.py fbref_scraper.py generar_matriz.py motor_predictivo_2026.py print_schema.py analytics/football-wc2026/scripts/
git mv concatenar.ipynb visual.ipynb analytics/football-wc2026/notebooks/
git mv equipos_mundial.json fbref_matchlogs.csv analytics/football-wc2026/data/raw/
git mv world_cup_ml_dataset.csv matriz_partidos.csv world_cup_master_dataset.json analytics/football-wc2026/data/processed/
git mv modelo_wc2026.joblib analytics/football-wc2026/models/
git mv match_reports analytics/football-wc2026/match_reports
git mv analisis_partido.md analytics/football-wc2026/prompts/
git mv proyecto-adiccion/analysis.py analytics/digital-addiction/analysis.py
git mv proyecto-adiccion/country_wise_analysis_addiction.csv proyecto-adiccion/screen_time_behavior.csv proyecto-adiccion/tiktok_instagram_global_100countries.csv analytics/digital-addiction/data/raw/
rmdir proyecto-adiccion   # falla si no está vacía, así que es seguro
```

### Fase 2: datos de la web → `data/` y `public/data/<proyecto>/`

```bash
mkdir -p data/football data/digital-addiction public/data/dynamic-pricing public/data/web-analytics
git mv ai_match_insights.json player_spotlight.json knockout_bracket.json live_form_index.json tracking_predicciones_2026.csv data/football/
git mv public/data_insights.json data/digital-addiction/data_insights.json
git mv public/data/forecast_48h.csv public/data/top_competitors_insights.json public/data/feature_importance.json public/data/dynamic-pricing/
git mv public/data/web_analytics_data.csv public/data/web-analytics/
```

### Fase 3: componentes y archivos sueltos

```bash
mkdir -p components/layout components/sections docs/legacy
git mv components/navbar.tsx components/footer.tsx components/providers.tsx components/layout/
git mv components/hero-section.tsx components/skills-section.tsx components/contact-section.tsx components/sections/
git mv design-system.json docs/
git mv index.html resume.html docs/legacy/
```

`debug.html` queda a tu decisión porque este plan no borra nada. La recomendación es sacarlo del control de versiones y guardarlo localmente, ya ignorado por git:

```bash
git rm --cached debug.html && mv debug.html analytics/football-wc2026/.local/
```

---

## ⚠️ Cambios de código obligatorios después del movimiento

Sin estos cambios, `next build` fallará o los dashboards quedarán vacíos.

### Next.js / TypeScript

| Archivo | Cambio |
|---|---|
| `app/layout.tsx:4-6` | `@/components/providers` → `@/components/layout/providers` (lo mismo para `navbar` y `footer`). |
| `app/page.tsx:1-3` | `@/components/hero-section` → `@/components/sections/hero-section` (lo mismo para `skills-section` y `contact-section`). |
| `app/projects/football-predictive-engine/dashboard/page.tsx:91` | `const root = process.cwd();` → `const root = path.join(process.cwd(), "data", "football");`. Es el único `process.cwd()` y lo usan los cinco lectores. **Es el riesgo principal:** `readFileSync` del CSV de tracking no tiene `existsSync`, así que fallaría en el build, y los demás lectores devolverían vacío en silencio. |
| `app/projects/digital-addiction-forecasting/page.tsx:14` | `path.join(process.cwd(), "public", "data_insights.json")` → `path.join(process.cwd(), "data", "digital-addiction", "data_insights.json")`. |
| `app/projects/dynamic-pricing/dashboard.tsx:237-239` | `"/data/forecast_48h.csv"` → `"/data/dynamic-pricing/forecast_48h.csv"` (lo mismo para los dos JSON). Este error **no aparece en el build**: solo verías un 404 en la consola del navegador. |
| `app/projects/web-analytics/dashboard.tsx:358` | `"/data/web_analytics_data.csv"` → `"/data/web-analytics/web_analytics_data.csv"`. También es un 404 silencioso. |

Los imports que empiezan con `@/components/ui/...` y `@/lib/utils`, y los imports relativos `./dashboard`, `./charts` y `./KnockoutTree`, **no cambian**.

### Python

Todas las rutas son strings relativos al CWD. Se recomienda crear `analytics/football-wc2026/scripts/paths.py`:

```python
from pathlib import Path
PROJECT   = Path(__file__).resolve().parents[1]   # analytics/football-wc2026
REPO      = PROJECT.parents[1]
RAW, PROCESSED = PROJECT / "data/raw", PROJECT / "data/processed"
MODELS, LOCAL  = PROJECT / "models", PROJECT / ".local"
WEB_DATA  = REPO / "data" / "football"            # lo que lee el dashboard
```

| Archivo | Constantes a cambiar |
|---|---|
| `motor_predictivo_2026.py:50-54` | `DATASET_CSV` → `PROCESSED/…`, `MODELO_FILE` → `MODELS/…`, y **`TRACKING_CSV`, `FORM_FILE`, `KNOCKOUT_FILE` → `WEB_DATA/…`** (si no, el motor escribirá archivos que la web no ve). |
| `etl_mundial.py:37-38, 367, 355` | `STATE_FILE`, `DB_FILE` y la caché de `requests_cache` → `LOCAL/…`; `LOCAL_LINEUPS_FILE` → `RAW/…`. |
| `generar_matriz.py:11-12` | `DB_FILE` → `LOCAL/…`, `OUT_FILE` → `PROCESSED/…`. |
| `fbref_scraper.py:277` | El valor por defecto de `output_csv` → `RAW/"fbref_matchlogs.csv"`. |
| `analysis.py:15-24` | Los CSV → `BASE/"data/raw"/…`; `OUT` → `REPO/"data/digital-addiction/data_insights.json"`. |
| `concatenar.ipynb`, `visual.ipynb` | `"fbref_matchlogs.csv"` → `"../data/raw/…"`, `"world_cup_ml_dataset.csv"` → `"../data/processed/…"`, `'mundial2026.db'` → `'../.local/mundial2026.db'`. |

`mundial2026.db`, `estado.json` y `http_cache.sqlite` **no están en la carpeta del repo** (están ignorados por git y probablemente en otra copia local). Muévelos a `analytics/football-wc2026/.local/`. Si no lo haces, el ETL creará una base vacía y empezará de cero.

### ⚠️ Antes de mover `index.html`

Si algún hosting estático (por ejemplo GitHub Pages) sirve el repo desde la raíz, moverlo rompe ese sitio. Revísalo en la configuración del repo. Si quieres que `resume.html` esté publicado en Vercel, la ubicación correcta es `public/resume.html`, que se sirve en `/resume.html`.

---

## Verificación por fase

```bash
npm run build
grep -rnE "process\.cwd|fetch\(\"/data" app
```

Después abre en `npm run dev` las cuatro rutas de `/projects/*` y `/projects/football-predictive-engine/dashboard`, y revisa que no haya 404 en la consola. Para Python, ejecuta `python analytics/football-wc2026/scripts/motor_predictivo_2026.py form` desde **otro** directorio: si funciona, las rutas ya no dependen del CWD.
