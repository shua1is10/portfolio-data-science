# Research Notes — YouTube Topic Intelligence

**Tópico:** Generative AI & AI Agents · **Ventanas:** 1 ene–30 sep 2025 vs 1 ene–30 sep 2026 · **Corte:** 30 sep 2026
**Estado del dataset:** sintético (`seed = 2026`, 2,340 videos, 22,302 comentarios). Ver §3 antes de citar cualquier cifra.

> **Advertencia de interpretación.** Mientras `data_source = "synthetic"`, los "hallazgos" de este documento y del sitio son propiedades del escenario simulado. Lo que demuestran es que el pipeline **recupera** efectos conocidos y que **no inventa** efectos que no puede identificar (§3.2). Para afirmar algo sobre YouTube hay que correr el pipeline con `YOUTUBE_API_KEY`.

---

## 1. Pregunta de investigación e hipótesis

> ¿Cómo cambió, año contra año, la oferta, el rendimiento, los formatos y el tono de la comunidad en el nicho de IA generativa en YouTube? ¿Qué implica para creadores y para marcas que invierten pauta ahí?

| # | Hipótesis | Métrica / prueba | Resultado (sintético) |
|---|---|---|---|
| H1 | La oferta crece más rápido que la demanda por video (saturación). | Volumen YoY; demanda por video | Oferta **+54%**. La demanda por video **no es identificable** con una sola captura (§4.1). Queda abierta. |
| H2 | El formato medio (3–20 min) gana eficiencia de engagement frente a Shorts. | Mediana EER por formato, bootstrap + Mann-Whitney | **Confirmada:** medio **+22%** [IC95 +15, +30], Shorts **−20%** [−24, −15], ambos p < 0.001. |
| H3 | La conversación se polariza en contenido de opinión. | % de comentarios críticos, z de dos proporciones | **Confirmada** en Opinion & Ethics: 27.4% → 40.6% (p < 0.001). También en Career & Monetization: 28.7% → 35.4% (p = 0.002). |
| H4 | La oferta se desplaza de noticias hacia agentes y automatización. | Cuota de uploads por subtópico | **Confirmada:** Agents 11.4% → 26.8%, News 20.0% → 12.0% (ambos p < 0.001). |
| H5 | El tono positivo se asocia con mejor rendimiento. | Spearman ρ | **Parcial:** se asocia con interacción (ρ con EER = 0.22 / 0.15) y casi nada con alcance (ρ con RVI = 0.04 / 0.07). |

---

## 2. Diseño

- **Unidad de análisis:** video. **Población objetivo:** videos en inglés que la búsqueda de YouTube asocia al tópico, publicados dentro de cada ventana.
- **Ventanas YTD emparejadas (ene–sep):** comparan los mismos meses para neutralizar la estacionalidad. No se usó el año calendario porque 2026 está incompleto.
- **Ingesta real** (`youtube_api.py`): `search.list` estratificado por **mes × query**, luego `videos.list` y `channels.list` en lotes de 50, y `commentThreads.list` con hasta 20 comentarios por video, ordenados por relevancia.
- **Presupuesto de cuota** (10,000 u/día): 3 queries × 18 meses × 100 u = 5,400 u en búsqueda; ~50 u en videos y canales; ~2,000–4,000 u en comentarios. El orden de descarga de comentarios se aleatoriza: si la cuota se agota, la pérdida no se concentra en un solo periodo. Las respuestas crudas se cachean en `data/raw/` para no gastar cuota al re-ejecutar.
- **Sin dependencias:** el pipeline usa solo la librería estándar de Python 3, así que corre en cualquier entorno sin `venv`.

---

## 3. Escenario sintético y validación del método

### 3.1 Efectos sembrados vs recuperados

El generador (`synthetic.py`, dict `SCENARIO`) usa el mismo esquema que `youtube_api.normalize()`. Simula acumulación saturante de vistas, un efecto leve de la edad sobre el engagement, comentarios en texto libre con negaciones y contrastes, y títulos ambiguos.

| Efecto | Sembrado | Recuperado | Lectura |
|---|---|---|---|
| Crecimiento de oferta | 920 → 1,420 (+54%) | +54% | Exacto (es un conteo). |
| EER Shorts, curr vs prev | ×0.80 (−20%) | −20.5% [−24, −15] | Recuperado. |
| EER formato medio | ×1.18 × pico en 8–12 min | +22.0% [+15, +30] | Recuperado (incluye la mezcla de duraciones dentro del formato). |
| EER formato largo | ×1.04 (+4%) | +9.7% [−2, +17], p = 0.13 | No significativo; el IC contiene el valor sembrado. |
| Comentarios negativos, Opinion | p(neg) 0.27 → 0.41 | críticos 27.4% → 40.6% | Recuperado vía NLP sobre el texto. |
| Comentarios negativos, Agents | p(neg) 0.13 → 0.18 | 18.0% → 20.5%, p = 0.07 | **Falso negativo:** el efecto es pequeño y la prueba tiene poca potencia. |
| Cuota de Agents | 9% → 27% | 11.4% → 26.8% | Recuperado; el clasificador por reglas añade ruido (91% de acierto). |
| **Demanda por video en curr** | **×0.80 (saturación)** | **No identificable** | Ver §3.2. |

### 3.2 Lo que el método se niega a afirmar

Se sembró una caída de demanda por video del 20% en 2026. Las métricas crudas dicen:

- vistas medianas: **−26%**, porque los videos de 2026 son más jóvenes y no han acumulado vistas;
- vistas por día: **+244%**, porque los videos de 2025 ya pasaron su pico y su promedio diario se diluye.

Las dos apuntan en direcciones opuestas y ninguna mide la demanda. Con **una sola captura**, la edad del video y el periodo están casi perfectamente confundidos: la mediana de edad es 499 días en 2025 contra 125 en 2026, y los rangos no se solapan. Por eso el pipeline **no** reporta comparaciones de velocidad entre años. Es el resultado correcto: un método que "encontrara" la saturación aquí estaría leyendo un artefacto.

---

## 4. Sesgos detectados y tratamiento

1. **Confusión edad × periodo** (el sesgo central).
   - Las comparaciones entre años se hacen sobre el **EER**, que es una razón y no un acumulado.
   - La velocidad solo se compara **dentro** de un periodo y franja de edad, mediante el **Relative Velocity Index**: velocidad / mediana del mismo periodo y franja de 30 días.
   - El dashboard lo declara junto al KPI de velocidad.
2. **¿El EER también depende de la edad?** Se probó en lugar de asumirlo.
   - ρ(edad, EER) = −0.05 dentro de 2026 y −0.06 dentro de 2025.
   - Si en 2026 solo se usan videos de ≥120 días (n = 734), el cambio YoY del EER pasa de −2.0% a −5.0%: ambos son "plano o ligeramente negativo".
   - Conclusión: el EER es robusto para comparar entre años.
3. **Madurez:** los videos de menos de 14 días se excluyen de la velocidad (100 videos), porque su ritmo diario aún no es estable.
4. **Sesgo de selección:** `search.list` devuelve una muestra curada por el algoritmo, no un censo, con sesgo hacia lo popular. Se mitiga con la estratificación mes × query. La interpretación se ajusta en consecuencia: el estudio describe lo que la plataforma **muestra** para el tópico.
5. **Cambio en la definición de Short:** desde oct-2024 los Shorts admiten hasta 180 s, así que el corte es 3 min y no 60 s. La franja de 1–3 min pasó de 44 a 199 videos. Con el corte viejo, eso se habría leído como una caída del formato medio.
6. **La retención no es observable:** la retención de audiencia y los compartidos solo existen en la YouTube Analytics API, que requiere OAuth del dueño del canal. El EER es un **proxy de interacción**, no de retención, y nunca se rotula como retención.
7. **Conteos ocultos:** un `likeCount` oculto se trata como `None`, no como 0, y el video sale del EER; imputar 0 sesgaría el EER a la baja. Lo mismo con suscriptores ocultos. También se excluyen los videos con menos de 100 vistas (7), porque con un denominador minúsculo el EER es inestable.
8. **Directos y estrenos:** se descartan los que no tienen duración o siguen en emisión, porque sus métricas están incompletas.
9. **Comparaciones múltiples:** se corren 18 pruebas (4 Mann-Whitney sobre EER, 7 de cuota y 7 de comentarios críticos). No se aplicó corrección formal, pero los hallazgos principales tienen p < 0.001 y sobreviven a Bonferroni con α = 0.05/18 ≈ 0.0028. Los de p entre 0.0028 y 0.05 se reportan como indicios.

---

## 5. Metodología estadística

| Métrica | Definición | Notas |
|---|---|---|
| Daily Velocity | views / días desde la publicación | Solo videos de ≥14 días; solo comparaciones dentro del periodo. |
| Engagement Efficiency Ratio | (likes + comments) / views × 100 | views ≥ 100; likes ocultos excluidos. |
| Relative Velocity Index | velocity / mediana(velocity · mismo periodo, misma franja de 30 d) | Franjas con menos de 8 videos usan la mediana del periodo. Los cortes de quintil son globales. |
| Sentiment Index | media del *compound* de los comentarios × 100 | Rango −100 … +100. |
| Comentario crítico | compound ≤ −0.05 | Umbral estándar de VADER. |

- **Resumen:** medianas, porque las métricas de YouTube tienen colas muy pesadas.
- **Incertidumbre:** IC del 95% por bootstrap percentil (1,000 remuestreos) del cambio % de la mediana.
- **Contraste:** Mann-Whitney U bilateral, con aproximación normal, corrección por continuidad y corrección por empates.
- **Tamaño de efecto:** Cliff's δ. |δ| < 0.147 es despreciable, < 0.33 pequeño y < 0.474 mediano. Shorts δ = −0.33 y formato medio δ = +0.31: efectos pequeños a medianos.
- **Proporciones:** prueba z de dos proporciones con varianza agrupada.
- **Asociación:** Spearman ρ con rangos promedio para empates.
- **NLP:**
  - **Sentimiento:** léxico de valencia estilo VADER con negación (ventana de 3 tokens, factor −0.74), intensificadores, contraste con "but" (antes ×0.5, después ×1.5) y énfasis por "!". Normalización x/√(x² + 15).
  - **Tópicos:** clasificador de reglas sobre título + tags; gana la categoría con más keywords y el desempate sigue el orden de la taxonomía. Acierto contra las etiquetas del generador: 90.9%, con 7.0% enviado a "Other".
  - **Términos emergentes:** log-odds ratio con prior de Dirichlet informativo (Monroe, Colaresi & Quinn, 2008), con prior α₀ = 500 tomado del corpus combinado. Se descartan los unigramas redundantes con un bigrama de iguales conteos.

---

## 6. Hallazgos clave (dataset sintético)

1. **Cambio de formato:** el formato medio gana eficiencia (+22%) y Shorts la pierde (−20%), aunque Shorts pasó del 37% al 47% de los uploads. El tramo de **8–12 min** tiene la EER mediana más alta en 2026: 5.67%, n = 211.
2. **Engagement plano por movimientos opuestos, no por mezcla.** El EER global cambió −2% [−6, +1], p = 0.09. *Hipótesis descartada en la bitácora:* se pensó que la causa era un efecto mezcla, es decir, más Shorts de menor EER. Pero en 2025 Shorts y formato medio tenían casi la misma EER (4.33% y 4.43%), así que cambiar la mezcla mueve el total ≈0%. Lo que ocurre es que la caída dentro de Shorts cancela la mejora dentro del formato medio.
3. **Polarización:** en Opinion & Ethics, los comentarios críticos subieron +13.2 pp y el índice de sentimiento pasó de +3.2 a −3.8. En Career & Monetization, +6.7 pp.
4. **Dinámica de tópicos:** Agents & Automation se convierte en el subtópico con más oferta (26.8%) y aun así mantiene un RVI mediano de 1.55× dentro de 2026: la demanda acompaña a la oferta. News & Releases cae al 12%. En títulos ganan peso "workflow", "agents", "automate" y "n8n", y pierden "make money" y "breaking".
5. **Tono vs rendimiento:** el tono acompaña a la interacción, no al alcance. Implicación: el sentimiento es una señal de calidad de comunidad, no un predictor de distribución.

---

## 7. Limitaciones y próximos pasos

- **Medir la demanda de verdad:** programar capturas periódicas (por ejemplo semanales) en `data/raw/` y calcular las **vistas ganadas en una ventana fija de edad** (día 7–30 de cada video). Es la única forma de responder H1.
- **Correr con la API real** y repetir la tabla §3.1 como control: los efectos recuperados en sintético deben "desaparecer" o cambiar, porque ya no están sembrados.
- **NLP:** sarcasmo, comentarios en otros idiomas y jerga no los cubre el léxico. Siguiente paso: un modelo transformer de sentimiento y modelado de tópicos con embeddings (BERTopic) cuando el entorno admita dependencias.
- **Retención y compartidos:** solo con la Analytics API y canales propios o de clientes con OAuth.
- **Potencia estadística:** Agents (Δ crítico +2.5 pp) no alcanza significancia con ~3k comentarios. Para detectar efectos de ese tamaño hacen falta ~3× más comentarios por subtópico.

---

## 8. Reproducibilidad

```bash
# sintético (por defecto si no hay API key)
python3 analytics/youtube-topic-intelligence/scripts/extract_and_process.py --source synthetic

# API real (cachea en data/raw/; --refresh fuerza la descarga)
YOUTUBE_API_KEY=... python3 analytics/youtube-topic-intelligence/scripts/extract_and_process.py --source api
```

| Salida | Consumidor |
|---|---|
| `analytics/youtube-topic-intelligence/data/processed/youtube_insights.json` | Análisis: registros procesados + resumen. |
| `data/youtube-topic-intelligence/insights_summary.json` | Caso de estudio. Next.js lo lee con `fs` en el build. |
| `public/data/youtube-topic-intelligence/videos.json` | Dashboard: filas compactas que se descargan con `fetch` y se filtran en el cliente. |
| `analytics/youtube-topic-intelligence/data/raw/` | Caché de la API / dataset sintético (en `.gitignore`). |

Toda la narrativa del sitio (titulares, evidencia y recomendaciones) **se genera desde los datos** en `build_highlights()` y `build_recommendations()`. Si los datos cambian, el texto cambia.

---

## 9. Bitácora

**2026-10-01**
- Se eligió el tópico (no especificado en el brief): Generative AI & AI Agents, por su relevancia comercial y por el desplazamiento claro de la oferta.
- Se decidió usar solo stdlib: el entorno no tenía numpy ni pandas, y sin dependencias el pipeline corre en cualquier sitio.
- Se detectó la confusión edad × periodo antes de escribir el análisis, y se rediseñó la estrategia: EER para comparar entre años y RVI dentro del periodo.
- Se redujeron las queries de 5 a 3 al presupuestar la cuota: 5 queries consumían 9,000 u solo en búsqueda y no quedaba cuota para comentarios.
- Se descartó la hipótesis del efecto mezcla al verla en los datos (§6.2); el titular se reescribió.
- Se corrigió una inconsistencia de límites: los formatos usaban (lo, hi] y los tramos de duración [lo, hi), así que un video de 180 s era Short pero caía en "3–8m". Ahora ambos usan (lo, hi].
- Se rediseñó la matriz sentimiento × rendimiento. En la primera versión, con celdas en % del total, el color solo reflejaba cuántos videos tenía cada columna de tono. Se normalizó por columna (20% = sin relación) con escala divergente, y se añadió un selector entre interacción y alcance.
