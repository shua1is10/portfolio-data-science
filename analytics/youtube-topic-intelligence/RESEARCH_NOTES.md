# Research Notes — YouTube Topic Intelligence

**Tópico:** AI Agents & Automation · **Ventanas:** 1 ene–30 sep 2025 vs 1 ene–30 sep 2026
**Datos:** YouTube Data API v3, descargados el 2026-10-02 (03:15 UTC) · 404 videos crudos → **375 analizados** (187 / 188) · 6,211 comentarios → **5,459 orgánicos en inglés** puntuados · 4,006 unidades de cuota.

---

## 0. Resumen ejecutivo

1. **Cambio algorítmico de formato.** Lo que YouTube muestra para el tópico se alargó. El formato largo (>10 min) pasa del 43.9% al 67.0% de los videos (q < 0.001), los Shorts (<1 min) del 32.6% al 12.2% (q < 0.001), y la duración mediana de 5.5 a 13.4 min (q < 0.001).
2. **Alcance e interacción se desacoplan.** En 2026, los videos largos obtienen más alcance relativo (ρ duración × velocidad relativa = 0.30, contra 0.04 en 2025). En cambio, la relación duración × engagement se invirtió: de +0.36 a −0.22. El engagement global sube **+14.8%** (q = 0.033), impulsado por los Shorts (+70%, n = 23, q = 0.002); el formato largo baja −10.7% (no significativo).
3. **Astroturfing.** El **31.6%** de los videos de 2025 tenía comentarios promocionales coordinados de 5 productos, frente al **3.7%** en 2026 (q < 0.001). Sin limpiarlos, el sentimiento y los términos emergentes quedaban contaminados.
4. **El sentimiento orgánico no cambia.** Los comentarios negativos pasan de 8.65% a 8.96% (q = 0.86) y el índice medio se queda en ~43. Indicio sin confirmar: Tools & Launches sube de 9.4% a 15.2% de comentarios negativos (q = 0.082).
5. **El vocabulario pasa de n8n a Claude Code.** En títulos, "n8n" cae de 20.3 a 4.3 por cada 100 videos, y "claude" sube de 1.1 a 9.0. El mismo giro aparece en lo que escribe la audiencia.

---

## 1. Pregunta e hipótesis

> ¿Cómo cambió, año contra año, lo que YouTube muestra sobre agentes de IA y automatización, y cómo responde la audiencia? ¿Qué implica para creadores y marcas?

| # | Hipótesis (formulada antes de ver los datos) | Prueba | Resultado |
|---|---|---|---|
| H1 | La oferta crece más rápido que la demanda (saturación). | — | **No se puede probar con este diseño.** El muestreo fija 12 videos por mes y query, así que el volumen mide el diseño, no el mercado (§3.3). |
| H2 | El formato medio gana eficiencia de engagement frente a Shorts. | Mediana + bootstrap + MWU + BH | **Rechazada.** Shorts **+70%** (q = 0.002); formato medio +44% sin significancia (q = 0.21). Lo que más cambió fue la **mezcla de formatos** (§0.1). |
| H3 | La conversación se polariza. | z de dos proporciones + BH | **Rechazada a nivel global** (8.65% → 8.96%, q = 0.86). Indicio solo en Tools & Launches (q = 0.082). |
| H4 | La oferta se desplaza entre subtópicos. | z de dos proporciones + BH | **Rechazada.** Ningún cambio de cuota sobrevive a la corrección (el menor es q = 0.082, en Build & Tutorials). El tópico cambió de **formato y vocabulario**, no de mezcla temática. |
| H5 | El tono positivo se asocia con rendimiento. | Spearman | **Inestable.** En 2025 el tono acompaña a la interacción (ρ con engagement = 0.21) y no al alcance (0.03); en 2026 se invierte (0.00 y 0.25). No hay una relación robusta. |

H2 a H4 venían del escenario sintético anterior. Los datos reales las contradicen y así se reportan.

---

## 2. Diseño y datos

- **Unidad:** video. **Población:** videos en inglés que la búsqueda de YouTube asocia a "AI agents" y "AI automation".
- **Ventanas YTD emparejadas (ene–sep)**, para neutralizar la estacionalidad.
- **Muestreo estratificado:** 18 meses × 2 queries × 12 resultados (`order=relevance`, `relevanceLanguage=en`), con paginación por `nextPageToken`. Da 407 IDs únicos, de los que 404 se pudieron recuperar.
- **Ingesta:** `videos.list` (`snippet,statistics,contentDetails`) en lotes de 50, `channels.list` para suscriptores, y `commentThreads.list` con los 20 comentarios principales por relevancia.
- **Cuota:** 36 búsquedas × 100 u + 9 lotes de videos + 5 de canales + 392 hilos de comentarios = **4,006 u** de 10,000 diarias. Hay pausa de 0.15 s entre llamadas y backoff exponencial ante 429/5xx.
- **Privacidad:** de los comentarios se guarda solo el texto, los likes y si los escribió el dueño del canal (booleano). Nunca autor ni canal. El dataset crudo (`data/raw/`) está en `.gitignore`.

**Embudo de limpieza:**

| Paso | Videos | Comentarios |
|---|---|---|
| Crudo | 404 | 6,211 |
| − idioma no inglés (metadato o título) | −29 | |
| − creador o con enlace (autopromoción) | | −156 |
| − duplicados entre ≥3 videos | | −14 |
| − promoción coordinada (5 marcas) | | −199 |
| − no inglés (heurística por comentario) | | −383 |
| **Analizado** | **375** | **5,459** |

Además: 19 videos con likes ocultos quedan fuera del engagement (no se imputan como 0), 12 videos de menos de 14 días quedan fuera de la velocidad, y 0 videos fueron fuera de tema (la búsqueda es muy precisa para este tópico).

**Taxonomía.** El clasificador por reglas se rediseñó a partir de los títulos reales. La versión sintética dejaba el 24% en "Other", con un grupo grande de *explainers* ("What are AI agents") sin categoría. Ahora: Build & Tutorials, Explainers & Concepts, Tools & Launches, Business & Monetization, Risks & Future of Work y Other (8.8%).

---

## 3. Sesgos detectados y tratamiento

### 3.1 Confusión edad × periodo
La edad mediana es de 511 días en 2025 y 142 en 2026. Las vistas crudas cambian **−56%** y las vistas por día **+132%**: direcciones opuestas, y ninguna es válida para comparar entre años.
- Entre años solo se comparan razones: engagement y tono.
- La velocidad se compara dentro de cada año mediante el Relative Velocity Index (RVI), es decir, la velocidad dividida entre la mediana de su año y franja de 30 días de edad.

### 3.2 El engagement **sí** depende de la edad en 2026
- ρ(edad, engagement) = **+0.25** en 2026 y +0.01 en 2025: los videos más antiguos de 2026 tienen más engagement.
- Una explicación posible: la búsqueda por relevancia rescata los videos de 2026 que ya funcionaron, y el engagement acumulado favorece a esos supervivientes.
- **Consecuencia:** la muestra de 2026 es más joven, así que el +14.8% YoY es una estimación **conservadora**.
- Restringiendo 2026 a videos de ≥120 días (n = 103), el cambio es **+25.0%**.

### 3.3 Muestra diseñada, no censo
Los conteos por mes son fijos por diseño, así que **no** se reportan crecimientos de volumen y el dashboard no tiene un KPI de "uploads". Las cuotas (formato, subtópico) describen **lo que la plataforma muestra** para la búsqueda, que es lo que encuentra un espectador o un comprador de medios. No describen el universo de videos publicados.

### 3.4 Definición de formatos
Los cortes del brief son: Short < 1 min, medio 1–10 min, largo > 10 min. Desde oct-2024 los Shorts pueden durar hasta 3 min, así que algunos caen en "medio". El gráfico de duración separa la franja de 1–3 min (28 → 9 videos).

### 3.5 Integridad de los comentarios (hallazgo metodológico principal)
- **Hallazgo:** campañas de comentarios **únicos y elogiosos** que mencionan siempre el mismo producto (Pneumatic Workflow, AICarma, Rumora, WorkBeaver y Backboard IO). Están escritos en un estilo típico de texto generado por LLM: elogio específico del video seguido de "I use X for this".
- **Por qué el filtro de duplicados no basta:** cada texto es distinto. Rumora, de hecho, se anuncia para "combinar comentarios automatizados con chatbots".
- **Detección:** `spam_report()` propone candidatos con la firma de una campaña: un nombre propio en comentarios de ≥8 videos que nunca lo mencionan, ~1 vez por video. Una persona confirma la lista, que está en `config.PROMO_BRANDS`.
  - El detector da falsos positivos ("Cheers", "Thankyou", "Gemini", "Youtube", "LLMs"…); por eso la confirmación es humana.
  - Lo revisado el 2026-10-02: 5 marcas confirmadas, y el resto son palabras comunes o marcas legítimas del tópico.
- **Impacto:** 199 comentarios, 77–88% positivos. Sin quitarlos:
  - "pneumatic workflow" aparecía como el **término de comentarios con mayor caída** (z = −4.1);
  - el sentimiento de 2025 se inflaba.
- **Sesgo residual:** los videos de 2025 tuvieron más tiempo para acumular spam. La caída de 31.6% a 3.7% mezcla el fin de las campañas con la antigüedad, y con una sola captura no se pueden separar.

### 3.6 Idioma y límites del NLP
- VADER es un léxico inglés, así que solo se puntúan comentarios en inglés (heurística: ≥85% de letras ASCII y alguna palabra funcional inglesa).
- No detecta el sarcasmo, y es frecuente en este tópico. Por ejemplo, *"AI will kill us all: by the way, buy my stock"* lo puntúa bien como negativo, pero otros casos fallan.
- Las citas del sitio se filtran: deben tratar del tópico, sin enlaces, menciones, groserías ni referencias a nacionalidades, y se publican sin autor.

### 3.7 Retención no observable
La retención y los compartidos solo existen en la YouTube Analytics API, que requiere OAuth del dueño del canal. El estudio mide el **engagement ratio** y nunca lo llama retención.

### 3.8 Comparaciones múltiples
Hay 24 pruebas en la familia, así que todas se corrigen con **Benjamini-Hochberg** y se reporta el q-value. Los términos emergentes (z del log-odds) son **exploratorios** y no entran en la corrección.

---

## 4. Metodología estadística

| Métrica | Definición | Notas |
|---|---|---|
| `daily_velocity` | views / días desde la publicación | Solo videos de ≥14 días; solo se compara dentro de un año. |
| `engagement_ratio` | (likes + comment_count) / views × 100 | views ≥ 100; likes ocultos excluidos. |
| `like_rate`, `comment_rate` | likes/views, comments/views × 100 | Componentes del engagement. |
| Relative Velocity Index | velocity / mediana(mismo año, franja de 30 d) | Franjas con menos de 8 videos usan la mediana del año. |
| `sentiment_index` | media del compound VADER × 100 | Mínimo 5 comentarios orgánicos en inglés por video. |
| Clase de tono | compound ≥ 0.05 positivo, ≤ −0.05 negativo | Umbrales estándar de VADER. |

- **Resumen:** medianas, porque hay colas pesadas.
- **Incertidumbre:** IC del 95% por bootstrap percentil (2,000 remuestreos) del cambio % de la mediana.
- **Contraste:** Mann-Whitney U bilateral con corrección por empates.
- **Tamaño de efecto:** Cliff's δ.
- **Proporciones:** z de dos proporciones.
- **Asociación:** Spearman ρ, siempre **por año** (ver §5.4 sobre la paradoja del ρ agrupado).
- **Multiplicidad:** Benjamini-Hochberg.
- **Términos:** log-odds ratio con prior de Dirichlet informativo (Monroe, Colaresi & Quinn, 2008). La unidad es el documento: en títulos, el título; en comentarios, todos los comentarios de un video, para que un solo video no domine.

> **Nota sobre IC vs prueba:** el engagement global tiene q = 0.033 pero un IC de la mediana de [−0.8%, +31.6%], que roza el 0. No es una contradicción: Mann-Whitney contrasta un desplazamiento de toda la distribución, y el bootstrap solo el de la mediana. La lectura honesta es "aumento moderado, probable pero de magnitud incierta".

---

## 5. Hallazgos detallados

### 5.1 Formato

| Formato | Cuota 2025 → 2026 | q | Engagement 2025 → 2026 | Δ | q | Cliff's δ |
|---|---|---|---|---|---|---|
| Short (<1 min) | 32.6% → 12.2% | <0.001 | 1.86% → 3.16% | +70.0% [+19, +150] | 0.002 | 0.50 |
| Medio (1–10 min) | 23.5% → 20.7% | 0.69 | 2.14% → 3.09% | +44.5% [−7, +101] | 0.21 | 0.21 |
| Largo (>10 min) | 43.9% → 67.0% | <0.001 | 2.91% → 2.60% | −10.7% [−21, +8] | 0.53 | −0.08 |

- Los Shorts de 2026 son pocos (n = 23), así que su +70% tiene un IC muy ancho.
- RVI mediano dentro de 2026: largo **1.10×**, Short **0.48×**. En 2025 estaban a la par (1.05 y 1.00).
- Por franja de duración (ambos años juntos), las de 20–40 min y 40+ min tienen el mayor RVI (1.82× y 1.80×) y la de 1–3 min el menor (0.38×).

### 5.2 Engagement global
- **Engagement:** +14.8% (q = 0.033).
- **Like rate:** +13.2% (q = 0.047).
- **Comment rate:** +22.7% (q = 0.014). La conversación crece más que la aprobación.

### 5.3 Sentimiento
- Mezcla de tono orgánico:
  - 2025: 73.6% positivo / 17.7% neutro / 8.7% negativo.
  - 2026: 75.1% / 16.0% / 9.0% (q = 0.86).
- Risks & Future of Work es el subtópico más crítico en ambos años (29.1% → 21.1% negativo, q = 0.26), aunque con pocos videos (7 y 8).
- Tools & Launches: 9.4% → 15.2% (q = 0.082), un indicio a vigilar.

### 5.4 Correlaciones (Spearman, por año)

| Par | 2025 | 2026 |
|---|---|---|
| Suscriptores × velocidad relativa | +0.36 | +0.38 |
| Like rate × comment rate | +0.52 | +0.54 |
| Duración × velocidad relativa | +0.04 | **+0.30** |
| Duración × engagement | **+0.36** | **−0.22** |
| Suscriptores × engagement | **+0.30** | **−0.20** |
| Sentimiento × engagement | +0.21 | 0.00 |
| Sentimiento × velocidad relativa | +0.03 | +0.25 |

- **Estable:** el tamaño del canal predice el alcance en ambos años.
- **Paradoja del ρ agrupado:** suscriptores × engagement da **+0.08** con los dos años juntos, pero +0.30 y −0.20 por separado. Los efectos se cancelan al agrupar, así que la narrativa evalúa siempre cada año por separado. La primera versión del texto decía "el engagement apenas depende del tamaño del canal" y se corrigió (§8).

### 5.5 Vocabulario (exploratorio)
- **Títulos:** suben "claude" (1.1 → 9.0 por cada 100), "claude code" (0 → 4.3) y "business". Bajan "n8n" (20.3 → 4.3), "agentic" y "automation agency".
- **Comentarios:** suben "claude" (8.9% → 27.1% de los videos), "security", "skill(s)" y "claude code". Bajan "n8n", "ai automation" y "easy to understand".

---

## 6. Implicaciones

- **Creadores:**
  - El formato largo gana alcance y los Shorts generan interacción, así que conviene usar los Shorts para abrir conversación, no para ser descubierto.
  - El vocabulario de la demanda migró hacia Claude Code, skills y seguridad.
- **Marcas:**
  - Auditar las secciones de comentarios antes de usar el sentimiento como KPI: en 2025, casi un tercio de los videos tenía astroturfing.
  - Fijar el precio del alcance según el tamaño del canal, y comparar el engagement solo dentro de un mismo tramo de suscriptores, porque esa relación cambió de signo.
  - Vigilar Tools & Launches sin actuar todavía.

---

## 7. Limitaciones y próximos pasos

- **Una sola captura.** Para medir demanda real hacen falta capturas periódicas y vistas ganadas en una ventana fija de edad (día 7–30). Es además la única forma de separar el "fin de las campañas de spam" del "efecto de la antigüedad".
- **n moderado:** ~190 videos por año y solo 23 Shorts en 2026. Ampliar `RESULTS_PER_QUERY_MONTH` cuesta ~100 u por cada 18 estratos × query.
- **Sesgo de relevancia:** la búsqueda devuelve videos ya exitosos (supervivencia). Alternativa: muestrear por canales en lugar de por búsqueda.
- **NLP:** sarcasmo e idiomas. Siguiente paso: un modelo transformer de sentimiento y tópicos con embeddings.
- **Detección de astroturfing:** la confirmación es manual. Con autor (que no se guarda por privacidad) o con una huella de estilo LLM se podría automatizar más.

---

## 8. Bitácora

**2026-10-01**
- Pipeline y web construidos sobre un dataset sintético mientras no había API key (ver historial de git).

**2026-10-02**
- Se eliminó el modo sintético: generador, aviso de "datos simulados" y comparaciones contra la "verdad sembrada".
- Se cambió el sentimiento a **VADER**: el léxico propio (~70 palabras) estaba hecho para frases sintéticas y con texto real dejaba casi todo en "neutral". Se aisló en `analytics/.venv`.
- Formatos según el brief (<1, 1–10, >10 min), manteniendo la franja de 1–3 min por la definición de Shorts.
- Descarga única: 4,006 u. Todo el análisis posterior reutiliza `data/raw/youtube_topic_raw.json` sin volver a gastar cuota.
- Taxonomía rediseñada con los títulos reales ("Other": 24% → 8.8%).
- Los términos de comentarios mostraban "pneumatic", "aicarma" y "utm campaign". La investigación reveló el astroturfing, así que se añadieron el filtro de duplicados, el `spam_report()` y la lista confirmada de 5 marcas, y se excluyeron los comentarios del creador o con enlaces (sus enlaces a Skool aparecían como "términos emergentes").
- Al limpiar los comentarios, Tools & Launches pasó de q = 0.037 (significativo) a q = 0.082, y se degradó a "indicio".
- Se corrigió la narrativa en tres puntos:
  - "en 2026 la franja de 20–40 min gana más alcance": el dato agrupa ambos años;
  - "el engagement apenas depende del tamaño del canal": paradoja del ρ agrupado;
  - "el mismo cambio aparece en los comentarios": ahora solo se dice si los términos coinciden.
- Se eliminó el KPI "crecimiento de uploads" porque con el muestreo fijo medía el diseño, no el mercado. La tendencia mensual pasa a ser la duración mediana.

---

## 9. Reproducibilidad

```bash
# entorno (una vez)
python3 -m venv analytics/.venv && analytics/.venv/bin/pip install python-dotenv vaderSentiment

# análisis sobre el crudo en caché (no gasta cuota)
analytics/.venv/bin/python analytics/youtube-topic-intelligence/scripts/extract_and_process.py

# nueva descarga (~4,000 u); la clave se lee de YOUTUBE_API_KEY o de .env.local
analytics/.venv/bin/python analytics/youtube-topic-intelligence/scripts/extract_and_process.py --refresh
```

| Salida | Consumidor |
|---|---|
| `data/raw/youtube_topic_raw.json` | Caché de la API (gitignored: contiene comentarios de terceros). |
| `data/processed/youtube_insights.json` | Registros procesados (sin texto de comentarios) + resumen. |
| `data/youtube-topic-intelligence/insights_summary.json` | Caso de estudio, leído con `fs` en el build. |
| `public/data/youtube-topic-intelligence/videos.json` | Dashboard, filas compactas vía `fetch`. |

Toda la narrativa del sitio se genera en `scripts/narrative.py`, condicionada a los q-values. Si los datos cambian, el texto cambia.
