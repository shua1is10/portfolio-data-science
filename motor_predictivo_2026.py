# -*- coding: utf-8 -*-
"""
===============================================================================
 MOTOR PREDICTIVO Y SISTEMA DE TRACKING - COPA MUNDIAL 2026
===============================================================================
 Lead Data Scientist / ML Engineering - Analitica Deportiva

 Pipeline completo en 5 modulos:
   1) Preparacion de datos     -> formato Match-Up (A vs B) con Deltas relativos
   2) Modelo predictivo        -> Regresion Logistica multiclase (probabilidades
                                  matematicas reales, bien calibradas por diseno)
   3) Tabla de predicciones    -> Jornada 1 de la fase de grupos (12 grupos x 2)
   4) Sistema de tracking      -> tracking_predicciones_2026.csv
   5) Actualizacion dinamica   -> actualizar_resultado_real() ajusta un
                                  live_form_index (ELO de forma) SIN reentrenar.
                                  Las predicciones de J2/J3 leen ese indice y
                                  las probabilidades evolucionan organicamente.

 USO EN TERMINAL:
   python motor_predictivo_2026.py                       # entrena (1 sola vez) + predice J1 + exporta tracking
   python motor_predictivo_2026.py predecir --jornada 2  # predice J2 leyendo el live_form_index actual
   python motor_predictivo_2026.py actualizar J1-A-1 0 2 --xg-a 0.8 --xg-b 1.9
   python motor_predictivo_2026.py form                  # ranking actual del live_form_index

 ARCHIVOS GENERADOS:
   modelo_wc2026.joblib            -> modelo entrenado (se entrena UNA vez; nunca por partido)
   tracking_predicciones_2026.csv  -> tabla de tracking de predicciones
   live_form_index.json            -> estado persistente del indice de forma
===============================================================================
"""

import argparse
import json
import os
import sys
import numpy as np
import pandas as pd
import joblib

from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import log_loss

# -----------------------------------------------------------------------------
# CONFIGURACION GLOBAL
# -----------------------------------------------------------------------------
DATASET_CSV   = "world_cup_ml_dataset.csv"
TRACKING_CSV  = "tracking_predicciones_2026.csv"
MODELO_FILE   = "modelo_wc2026.joblib"
FORM_FILE     = "live_form_index.json"
RANDOM_STATE  = 42

# Hiperparametros del sistema de forma dinamica (live_form_index)
FORM_INICIAL  = 1.00   # valor neutro (equipos sin odds de mercado)
K_PRIOR       = 0.20   # peso del momentum inicial derivado de prob_implicita_pct
K_WIN         = 0.35   # boost maximo por ganar (escala con la sorpresa)
K_LOSE        = 0.25   # castigo maximo por perder (escala con la sorpresa)
K_DRAW        = 0.10   # ajuste suave en empates (favorece al no-favorito)
K_MARGEN      = 0.04   # bonus extra por cada gol de margen por encima de 1
K_XG          = 0.08   # peso del rendimiento xG real del partido (si se da)
GAMMA_FORM    = 0.60   # sensibilidad de las probabilidades al ratio de forma
FORM_MIN      = 0.60   # limites del indice para evitar divergencias
FORM_MAX      = 1.80

# Features Delta del modelo (diferencias A - B). Incluyen las 4 exigidas
# (xG, posesion, prob. implicita, titulos) + senales de rendimiento extra.
FEATURES = [
    "delta_xg",              # diferencia de xG medio (proxy: goles a favor, ver nota)
    "delta_xga",             # diferencia de xG concedido medio (proxy: goles en contra)
    "delta_posesion",        # diferencia de posesion media (%)
    "delta_prob_implicita",  # diferencia de probabilidad implicita de apuestas (%)
    "delta_titulos",         # diferencia de titulos mundiales historicos
    "delta_finales",         # diferencia de finales historicas
    "delta_semis",           # diferencia de semifinales historicas
    "delta_winrate",         # diferencia de % de victorias en los logs
    "delta_forma_reciente",  # diferencia de puntos/partido en los ultimos 5 juegos
]

# Etiquetas multiclase desde la perspectiva del Equipo A
CLASES = ["A", "E", "B"]   # Victoria A / Empate / Victoria B

# Calendario OFICIAL de la Jornada 1 (24 cruces). Es la fuente de verdad del
# orden de los grupos: el primer par de cada grupo define [pos0, pos1] y el
# segundo [pos2, pos3], de donde se derivan combinatoriamente las J2 y J3.
FIXTURES_OFICIALES_J1 = [
    ("Mexico", "South Africa"),
    ("South Korea", "Czechia"),
    ("Canada", "Bosnia & Herzegovina"),
    ("United States", "Paraguay"),
    ("Qatar", "Switzerland"),
    ("Brazil", "Morocco"),
    ("Haiti", "Scotland"),
    ("Australia", "Turkey"),
    ("Germany", "Curaçao"),
    ("Netherlands", "Japan"),
    ("Ivory Coast", "Ecuador"),
    ("Sweden", "Tunisia"),
    ("Spain", "Cape Verde"),
    ("Belgium", "Egypt"),
    ("Saudi Arabia", "Uruguay"),
    ("Iran", "New Zealand"),
    ("France", "Senegal"),
    ("Iraq", "Norway"),
    ("Argentina", "Algeria"),
    ("Austria", "Jordan"),
    ("Portugal", "DR Congo"),
    ("England", "Croatia"),
    ("Ghana", "Panama"),
    ("Uzbekistan", "Colombia"),
]


# =============================================================================
# MODULO 1: PREPARACION DE DATOS (perfiles por equipo + formato Match-Up)
# =============================================================================

def cargar_dataset(path=DATASET_CSV):
    """Carga el log de partidos por equipo y normaliza el nombre del oponente.

    El campo 'oponente' viene con un prefijo de codigo de pais en minusculas
    ('pt Portugal', 'be Belgium'); se elimina para poder cruzarlo contra la
    columna 'equipo' y asi reconstruir partidos entre clasificados.
    """
    df = pd.read_csv(path)
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df["oponente_limpio"] = (
        df["oponente"].astype(str).str.replace(r"^[a-z]{2,3}\s+", "", regex=True)
    )
    return df


def construir_perfiles(df):
    """Colapsa el log de partidos en un perfil estatico por equipo.

    NOTA SOBRE xG: la columna 'xg' del dataset esta vacia al 100%, por lo que
    se usa el promedio de goles a favor como proxy de xG ofensivo y los goles
    en contra como proxy de xGA. Si en el futuro el scraper llena 'xg'/'xga',
    este codigo los usara automaticamente (np.nanmean con fallback).
    """
    perfiles = {}
    for equipo, g in df.groupby("equipo"):
        jugados = g["resultado"].notna().sum()
        if jugados == 0:
            continue
        res = g["resultado"].dropna()

        # Forma reciente: puntos por partido en los ultimos 5 juegos con resultado
        ult5 = g.dropna(subset=["resultado"]).sort_values("fecha").tail(5)["resultado"]
        pts = ult5.map({"W": 3, "D": 1, "L": 0}).sum()
        forma_reciente = pts / max(len(ult5), 1)

        # xG real si existe; si no, proxy con goles (ver nota del docstring)
        xg_medio  = g["xg"].mean()  if g["xg"].notna().any()  else g["goles_favor"].mean()
        xga_medio = g["xga"].mean() if g["xga"].notna().any() else g["goles_contra"].mean()

        perfiles[equipo] = {
            "grupo":          str(g["grupo"].iloc[0]).replace("Group ", "").strip(),
            "xg_medio":       xg_medio,
            "xga_medio":      xga_medio,
            "posesion":       g["posesion"].mean(),          # puede ser NaN -> imputer
            "prob_implicita": g["prob_implicita_pct"].mean(),
            "titulos":        g["titulos_historicos"].mean(),
            "finales":        g["finales_historicas"].mean(),
            "semis":          g["semis_historicas"].mean(),
            "winrate":        (res == "W").mean(),
            "forma_reciente": forma_reciente,
        }
    return perfiles


def features_matchup(pA, pB):
    """Construye el vector de Deltas relativos (Equipo A - Equipo B)."""
    return {
        "delta_xg":             pA["xg_medio"]       - pB["xg_medio"],
        "delta_xga":            pA["xga_medio"]      - pB["xga_medio"],
        "delta_posesion":       pA["posesion"]       - pB["posesion"],
        "delta_prob_implicita": pA["prob_implicita"] - pB["prob_implicita"],
        "delta_titulos":        pA["titulos"]        - pB["titulos"],
        "delta_finales":        pA["finales"]        - pB["finales"],
        "delta_semis":          pA["semis"]          - pB["semis"],
        "delta_winrate":        pA["winrate"]        - pB["winrate"],
        "delta_forma_reciente": pA["forma_reciente"] - pB["forma_reciente"],
    }


def construir_dataset_entrenamiento(df, perfiles):
    """Genera el set supervisado Match-Up a partir de los partidos historicos.

    Cada fila del log donde el oponente tambien es un clasificado con perfil
    se convierte en un ejemplo (deltas A-B, etiqueta W/D/L desde A). El mismo
    partido puede aparecer desde ambas perspectivas: actua como augmentation
    simetrica y mantiene al modelo insensible al orden A/B.
    """
    filas, etiquetas = [], []
    mapa = {"W": "A", "D": "E", "L": "B"}
    for _, r in df.dropna(subset=["resultado"]).iterrows():
        a, b = r["equipo"], r["oponente_limpio"]
        if a in perfiles and b in perfiles:
            filas.append(features_matchup(perfiles[a], perfiles[b]))
            etiquetas.append(mapa[r["resultado"]])
    X = pd.DataFrame(filas, columns=FEATURES)
    y = pd.Series(etiquetas, name="outcome")
    return X, y


# =============================================================================
# MODULO 2: MODELO PREDICTIVO (Regresion Logistica multiclase)
# =============================================================================

def entrenar_modelo(X, y):
    """Entrena el clasificador multiclase y reporta metricas de calibracion.

    Se usa Regresion Logistica multinomial: sus salidas son probabilidades
    matematicas reales (optimiza log-loss directamente), a diferencia de un
    Random Forest sin calibrar. Pipeline con imputacion (posesion tiene NaN)
    y estandarizacion para que la regularizacion L2 sea homogenea.

    IMPORTANTE: este entrenamiento ocurre UNA sola vez y el modelo se persiste
    en disco. El sistema de tracking NUNCA reentrena por partido.
    """
    modelo = Pipeline([
        ("imputer", SimpleImputer(strategy="mean")),
        ("scaler",  StandardScaler()),
        ("clf",     LogisticRegression(max_iter=2000, C=0.5,
                                       random_state=RANDOM_STATE)),
    ])

    # Validacion cruzada estratificada: accuracy y log-loss (calidad de probas)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    acc = cross_val_score(modelo, X, y, cv=cv, scoring="accuracy")
    nll = -cross_val_score(modelo, X, y, cv=cv, scoring="neg_log_loss")
    print(f"[MODELO] {len(X)} match-ups de entrenamiento | "
          f"CV accuracy: {acc.mean():.3f} +/- {acc.std():.3f} | "
          f"CV log-loss: {nll.mean():.3f}")

    modelo.fit(X, y)
    # Log-loss de un modelo ingenuo (frecuencias de clase) como linea base
    p_base = y.value_counts(normalize=True).reindex(modelo.classes_).values
    base = log_loss(y, np.tile(p_base, (len(y), 1)), labels=modelo.classes_)
    print(f"[MODELO] log-loss baseline (frecuencias): {base:.3f} "
          f"-> el modelo {'SUPERA' if nll.mean() < base else 'NO supera'} la linea base")

    joblib.dump(modelo, MODELO_FILE)
    print(f"[MODELO] Persistido en '{MODELO_FILE}' (no se reentrena por partido)")
    return modelo


def cargar_o_entrenar_modelo(df, perfiles, forzar=False):
    """Carga el modelo de disco; solo entrena si no existe (o se fuerza)."""
    if os.path.exists(MODELO_FILE) and not forzar:
        print(f"[MODELO] Cargado desde '{MODELO_FILE}' (sin reentrenar)")
        return joblib.load(MODELO_FILE)
    X, y = construir_dataset_entrenamiento(df, perfiles)
    return entrenar_modelo(X, y)


# =============================================================================
# MODULO 5 (estado): LIVE FORM INDEX - ELO dinamico de forma
# =============================================================================

def cargar_form(perfiles):
    """Carga el live_form_index persistido o lo inicializa con el momentum
    previo al torneo.

    En lugar de un arranque plano en 1.00, el indice inicial escala la
    probabilidad implicita del mercado de apuestas (prob_implicita_pct) en
    escala logaritmica estandarizada:

        form_0 = clip(1 + K_PRIOR * z,  FORM_MIN, FORM_MAX)
        z      = (log(prob) - media(log(prob))) / std(log(prob))

    Asi el maximo favorito del mercado (Espana, 17.4%) arranca organicamente
    como numero 1 del Form Index, y los equipos sin cotizacion quedan neutros
    en 1.00. El estado inicial se persiste para que el dashboard lo lea.
    """
    if os.path.exists(FORM_FILE):
        form = {eq: FORM_INICIAL for eq in perfiles}
        with open(FORM_FILE, "r", encoding="utf-8") as f:
            form.update(json.load(f))
        return form

    # Estandarizacion log-normal de las probabilidades de mercado disponibles
    probs = {eq: p["prob_implicita"] for eq, p in perfiles.items()
             if not np.isnan(p["prob_implicita"]) and p["prob_implicita"] > 0}
    logs  = np.log(np.array(list(probs.values())))
    mu, sigma = logs.mean(), logs.std()

    form = {}
    for eq in perfiles:
        if eq in probs and sigma > 0:
            z = (np.log(probs[eq]) - mu) / sigma
            form[eq] = float(np.clip(FORM_INICIAL + K_PRIOR * z,
                                     FORM_MIN, FORM_MAX))
        else:
            form[eq] = FORM_INICIAL

    guardar_form(form)
    return form


def guardar_form(form):
    """Persiste el live_form_index para que sobreviva entre ejecuciones."""
    with open(FORM_FILE, "w", encoding="utf-8") as f:
        json.dump(form, f, ensure_ascii=False, indent=2)


# =============================================================================
# MODULO 2/5: PREDICCION DE UN PARTIDO (modelo estatico + forma dinamica)
# =============================================================================

def predecir_partido(modelo, perfiles, form, equipo_A, equipo_B):
    """Devuelve (prob_A, prob_Empate, prob_B) para un match-up.

    Paso 1: el modelo estatico (entrenado una vez) produce probabilidades base
            a partir de los Deltas del perfil.
    Paso 2: se aplica el live_form_index como 'tilt' multiplicativo sobre las
            cuotas: si A viene en racha (form > 1) sus odds se inflan con
            exponente GAMMA_FORM y luego se renormaliza. Esto hace evolucionar
            las probabilidades durante el torneo SIN tocar el modelo.
    """
    X = pd.DataFrame([features_matchup(perfiles[equipo_A], perfiles[equipo_B])],
                     columns=FEATURES)
    proba = modelo.predict_proba(X)[0]
    p = dict(zip(modelo.classes_, proba))          # {'A': pA, 'B': pB, 'E': pE}

    # Tilt por forma: ratio de indices elevado a GAMMA_FORM
    ratio = (form.get(equipo_A, FORM_INICIAL) /
             form.get(equipo_B, FORM_INICIAL)) ** GAMMA_FORM
    pA = p["A"] * ratio
    pB = p["B"] / ratio
    pE = p["E"]
    total = pA + pE + pB                            # renormalizacion a 1.0
    return pA / total, pE / total, pB / total


# =============================================================================
# MODULO 3: FIXTURES Y TABLA DE PREDICCIONES POR JORNADA
# =============================================================================

def generar_fixtures(perfiles, jornada):
    """Genera los partidos de una jornada de fase de grupos (formato 2026).

    La Jornada 1 reproduce ESTRICTAMENTE los 24 cruces del calendario oficial
    (FIXTURES_OFICIALES_J1). El orden canonico de cada grupo se deriva de esos
    pares: [parA_local, parA_visita, parB_local, parB_visita], y las jornadas
    restantes completan el round-robin de forma consistente:
      J1: (0 vs 1) y (2 vs 3)   |   J2: (0 vs 2) y (1 vs 3)   |   J3: (0 vs 3) y (1 vs 2)
    """
    emparejes = {1: [(0, 1), (2, 3)], 2: [(0, 2), (1, 3)], 3: [(0, 3), (1, 2)]}
    if jornada not in emparejes:
        raise ValueError("La fase de grupos solo tiene jornadas 1, 2 y 3")

    # El calendario oficial define la composicion y el orden de cada grupo
    grupos = {}
    for a, b in FIXTURES_OFICIALES_J1:
        if a not in perfiles or b not in perfiles:
            raise KeyError(
                f"Equipo del calendario oficial sin perfil en el dataset: "
                f"'{a}' / '{b}'")
        grupo = perfiles[a]["grupo"]
        if perfiles[b]["grupo"] != grupo:
            raise ValueError(
                f"Cruce oficial entre grupos distintos: {a} ({grupo}) vs "
                f"{b} ({perfiles[b]['grupo']})")
        grupos.setdefault(grupo, []).extend([a, b])

    fixtures = []
    for grupo in sorted(grupos):
        equipos = grupos[grupo]
        if len(equipos) != 4:
            raise ValueError(
                f"El grupo {grupo} no tiene exactamente 2 cruces oficiales")
        for i, (a, b) in enumerate(emparejes[jornada], start=1):
            fixtures.append({
                "match_id": f"J{jornada}-{grupo}-{i}",
                "fase":     f"Fase de Grupos - Jornada {jornada}",
                "equipo_A": equipos[a],
                "equipo_B": equipos[b],
            })
    return fixtures


def generar_tabla_predicciones(modelo, perfiles, form, jornada):
    """Calcula las probabilidades de todos los partidos de la jornada."""
    filas = []
    for fx in generar_fixtures(perfiles, jornada):
        pA, pE, pB = predecir_partido(modelo, perfiles, form,
                                      fx["equipo_A"], fx["equipo_B"])
        pred = {0: fx["equipo_A"], 1: "Empate", 2: fx["equipo_B"]}[
            int(np.argmax([pA, pE, pB]))]
        filas.append({**fx,
                      "prob_A": round(pA, 4),
                      "prob_Empate": round(pE, 4),
                      "prob_B": round(pB, 4),
                      "prediccion_modelo": pred})
    return pd.DataFrame(filas)


# =============================================================================
# MODULO 4: SISTEMA DE TRACKING (export y merge no destructivo)
# =============================================================================

COLS_TRACKING = ["match_id", "fase", "equipo_A", "equipo_B",
                 "prob_A", "prob_Empate", "prob_B", "prediccion_modelo",
                 "resultado_real", "goles_A_real", "goles_B_real",
                 "acierto_prediccion"]


def exportar_tracking(tabla):
    """Vuelca las predicciones al CSV de tracking SIN destruir resultados.

    - Partidos nuevos: se agregan con resultado_real = 'Pendiente'.
    - Partidos existentes aun 'Pendiente': se refrescan sus probabilidades
      (asi la J2 recalculada con el live_form_index queda registrada).
    - Partidos ya resueltos: se conservan intactos (auditoria del modelo).
    """
    nueva = tabla.copy()
    nueva["resultado_real"]     = "Pendiente"
    nueva["goles_A_real"]       = np.nan
    nueva["goles_B_real"]       = np.nan
    nueva["acierto_prediccion"] = ""

    if os.path.exists(TRACKING_CSV):
        actual = pd.read_csv(TRACKING_CSV)
        resueltos = actual[actual["resultado_real"] != "Pendiente"]
        # Solo se reescriben filas pendientes o inexistentes
        nueva = nueva[~nueva["match_id"].isin(resueltos["match_id"])]
        restantes = actual[~actual["match_id"].isin(nueva["match_id"])]
        salida = pd.concat([restantes, nueva], ignore_index=True)
    else:
        salida = nueva

    salida = salida[COLS_TRACKING].sort_values("match_id")
    salida.to_csv(TRACKING_CSV, index=False, encoding="utf-8")
    print(f"[TRACKING] '{TRACKING_CSV}' actualizado ({len(salida)} partidos)")
    return salida


# =============================================================================
# MODULO 5: ACTUALIZACION DINAMICA DE RESULTADOS + LIVE FORM INDEX
# =============================================================================

def actualizar_resultado_real(match_id, goles_A, goles_B, xG_A=None, xG_B=None):
    """Registra el resultado real de un partido y ajusta el live_form_index.

    Logica del ajuste (sin reentrenar JAMAS el modelo):
      1. Se lee la probabilidad que el modelo asigno al desenlace ocurrido.
         sorpresa = 1 - prob(desenlace)  ->  cuanto mas improbable, mayor ajuste.
      2. Ganador: form *= 1 + K_WIN * sorpresa  (ganar contra pronostico paga mas)
         Perdedor: form *= 1 - K_LOSE * sorpresa
         Empate:  el no-favorito recibe un micro-boost y el favorito un micro-castigo.
      3. Margen de goles: cada gol de diferencia por encima de 1 amplifica el ajuste.
      4. xG del partido (opcional): tanh((xG_A - xG_B)/2) * K_XG corrige por
         calidad real de juego (un equipo que pierde pero domina el xG sufre
         menos castigo; un ganador 'con suerte' recibe menos boost).
      5. El indice se acota a [FORM_MIN, FORM_MAX] y se persiste a JSON para
         que las predicciones de la siguiente jornada lo lean.
    """
    if not os.path.exists(TRACKING_CSV):
        raise FileNotFoundError(
            f"No existe '{TRACKING_CSV}'. Ejecuta primero las predicciones.")

    tracking = pd.read_csv(TRACKING_CSV)
    # Las columnas de resultado llegan como float64/NaN cuando todo esta
    # 'Pendiente'; se fuerzan a object para poder escribir strings sin error.
    for col in ("resultado_real", "acierto_prediccion"):
        tracking[col] = tracking[col].astype("object")
    mask = tracking["match_id"] == match_id
    if not mask.any():
        raise KeyError(f"match_id '{match_id}' no encontrado en el tracking")

    fila = tracking.loc[mask].iloc[0]
    eq_A, eq_B = fila["equipo_A"], fila["equipo_B"]

    # ---- 1) Resolver el desenlace real y el acierto del modelo ----
    if goles_A > goles_B:
        resultado, prob_real, ganador, perdedor = "Victoria A", fila["prob_A"], eq_A, eq_B
    elif goles_B > goles_A:
        resultado, prob_real, ganador, perdedor = "Victoria B", fila["prob_B"], eq_B, eq_A
    else:
        resultado, prob_real, ganador, perdedor = "Empate", fila["prob_Empate"], None, None

    pred = fila["prediccion_modelo"]
    acierto = ((resultado == "Victoria A" and pred == eq_A) or
               (resultado == "Victoria B" and pred == eq_B) or
               (resultado == "Empate" and pred == "Empate"))

    tracking.loc[mask, ["resultado_real", "goles_A_real", "goles_B_real",
                        "acierto_prediccion"]] = [resultado, goles_A, goles_B,
                                                  "SI" if acierto else "NO"]
    tracking.to_csv(TRACKING_CSV, index=False, encoding="utf-8")

    # ---- 2-4) Ajuste del live_form_index en memoria ----
    df = cargar_dataset()
    perfiles = construir_perfiles(df)
    form = cargar_form(perfiles)

    sorpresa = 1.0 - float(prob_real)              # 0 = cantado, ~1 = batacazo
    margen = abs(goles_A - goles_B)
    amp_margen = 1.0 + K_MARGEN * max(margen - 1, 0)   # goleadas pesan mas

    if ganador is not None:
        form[ganador]  *= 1.0 + K_WIN  * sorpresa * amp_margen
        form[perdedor] *= 1.0 - K_LOSE * sorpresa * amp_margen
    else:
        # Empate: quien tenia menos probabilidad de ganar 'gana' credibilidad
        favorito, otro = (eq_A, eq_B) if fila["prob_A"] >= fila["prob_B"] else (eq_B, eq_A)
        desequilibrio = abs(fila["prob_A"] - fila["prob_B"])
        form[otro]     *= 1.0 + K_DRAW * desequilibrio
        form[favorito] *= 1.0 - K_DRAW * desequilibrio

    # Correccion por calidad de juego (xG real del partido, si se proporciona)
    if xG_A is not None and xG_B is not None:
        ajuste_xg = float(np.tanh((xG_A - xG_B) / 2.0)) * K_XG
        form[eq_A] *= 1.0 + ajuste_xg
        form[eq_B] *= 1.0 - ajuste_xg

    # ---- 5) Acotar y persistir ----
    for eq in (eq_A, eq_B):
        form[eq] = float(np.clip(form[eq], FORM_MIN, FORM_MAX))
    guardar_form(form)

    print(f"[RESULTADO] {match_id}: {eq_A} {goles_A}-{goles_B} {eq_B} "
          f"({resultado}) | prediccion: {pred} -> {'ACIERTO' if acierto else 'FALLO'}")
    print(f"[FORM] sorpresa={sorpresa:.3f} | "
          f"{eq_A}: {form[eq_A]:.3f} | {eq_B}: {form[eq_B]:.3f}")
    print("[FORM] Indice persistido: la proxima jornada usara estos valores "
          "(el modelo NO se reentrena).")
    return form


# =============================================================================
# CLI - ORQUESTACION EN TERMINAL
# =============================================================================

def comando_predecir(jornada, reentrenar=False):
    """Pipeline: cargar datos -> perfiles -> modelo -> predicciones -> tracking."""
    df = cargar_dataset()
    perfiles = construir_perfiles(df)
    modelo = cargar_o_entrenar_modelo(df, perfiles, forzar=reentrenar)
    form = cargar_form(perfiles)

    tabla = generar_tabla_predicciones(modelo, perfiles, form, jornada)
    print(f"\n===== PREDICCIONES JORNADA {jornada} (con live_form_index) =====")
    with pd.option_context("display.width", 160, "display.max_columns", None):
        print(tabla.to_string(index=False))
    exportar_tracking(tabla)


def comando_form():
    """Muestra el ranking actual del live_form_index."""
    perfiles = construir_perfiles(cargar_dataset())
    form = cargar_form(perfiles)
    ranking = sorted(form.items(), key=lambda kv: kv[1], reverse=True)
    print("\n===== LIVE FORM INDEX (ELO dinamico de forma) =====")
    for i, (eq, v) in enumerate(ranking, 1):
        marca = "+" if v > 1.0 else ("-" if v < 1.0 else "=")
        print(f"{i:>2}. [{marca}] {eq:<22} {v:.3f}")


def main():
    parser = argparse.ArgumentParser(
        description="Motor Predictivo y Sistema de Tracking - Mundial 2026")
    sub = parser.add_subparsers(dest="comando")

    p_pred = sub.add_parser("predecir", help="Genera predicciones de una jornada")
    p_pred.add_argument("--jornada", type=int, default=1, choices=[1, 2, 3])
    p_pred.add_argument("--reentrenar", action="store_true",
                        help="Fuerza reentrenamiento del modelo base (solo mantenimiento)")

    p_act = sub.add_parser("actualizar", help="Registra un resultado real")
    p_act.add_argument("match_id", help="Ej: J1-A-1")
    p_act.add_argument("goles_A", type=int)
    p_act.add_argument("goles_B", type=int)
    p_act.add_argument("--xg-a", type=float, default=None, dest="xg_a")
    p_act.add_argument("--xg-b", type=float, default=None, dest="xg_b")

    sub.add_parser("form", help="Muestra el live_form_index actual")

    args = parser.parse_args()
    if args.comando == "actualizar":
        actualizar_resultado_real(args.match_id, args.goles_A, args.goles_B,
                                  xG_A=args.xg_a, xG_B=args.xg_b)
    elif args.comando == "form":
        comando_form()
    elif args.comando == "predecir":
        comando_predecir(args.jornada, reentrenar=args.reentrenar)
    else:
        # Sin argumentos: flujo completo por defecto (entrenar si hace falta + J1)
        comando_predecir(jornada=1)


if __name__ == "__main__":
    main()
