"""
nlp.py
  - score_sentiment: VADER (Hutto & Gilbert, 2014), lexico validado para texto de redes
    sociales (7.5k entradas, emojis, mayusculas, negacion, "but"). Devuelve el compound.
  - looks_english: filtro heuristico de idioma. VADER es un lexico ingles: puntuar
    comentarios en otros idiomas los mandaria a "neutral" y sesgaria el indice hacia 0.
  - classify_category: clasificador de subtopicos por reglas (limites de palabra).
  - emerging_terms: log-odds ratio con prior de Dirichlet informativo (Monroe et al., 2008).
  - pick_quotes: comentarios representativos, cortos y sin datos personales.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any, Iterable

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from config import CATEGORIES, NEGATIVE_THRESHOLD, OTHER_CATEGORY, POSITIVE_THRESHOLD

_VADER = SentimentIntensityAnalyzer()


def score_sentiment(text: str) -> float:
    return float(_VADER.polarity_scores(text)["compound"])


def sentiment_class(compound: float) -> str:
    if compound >= POSITIVE_THRESHOLD:
        return "positive"
    if compound <= NEGATIVE_THRESHOLD:
        return "negative"
    return "neutral"


# -----------------------------------------------------------------------------
# Idioma
# -----------------------------------------------------------------------------
_EN_STOP = frozenset("""
the a an and or but is are was were be been it this that to of in on for with you your i my we
not no do does did have has can will just so what how why if they them he she me at as all
""".split())
_WORD = re.compile(r"[a-z']+")


def looks_english(text: str) -> bool:
    """>=85% de letras ASCII y al menos una palabra funcional inglesa (o un unico token
    en ingles con carga emocional, p. ej. 'amazing!'). Conservador a proposito."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    ascii_share = sum(1 for c in letters if c.isascii()) / len(letters)
    if ascii_share < 0.85:
        return False
    words = _WORD.findall(text.lower())
    if any(w in _EN_STOP for w in words):
        return True
    return len(words) <= 3 and any(w in _VADER.lexicon for w in words)


# -----------------------------------------------------------------------------
# Subtopicos
# -----------------------------------------------------------------------------
def _kw_pattern(kw: str) -> re.Pattern[str]:
    # limites de palabra solo donde el keyword empieza/termina en caracter de palabra
    left = r"\b" if kw[:1].isalnum() else ""
    right = r"\b" if kw[-1:].isalnum() else ""
    return re.compile(left + re.escape(kw.strip()) + right)


_CATEGORY_PATTERNS = [(key, [_kw_pattern(k) for k in kws]) for key, _label, kws in CATEGORIES]


def classify_category(title: str, tags: Iterable[str] = ()) -> str:
    """Categoria con mas keywords presentes; empate -> orden de CATEGORIES."""
    text = f" {title.lower()} {' '.join(tags).lower()} "
    best_key, best_hits = OTHER_CATEGORY[0], 0
    for key, patterns in _CATEGORY_PATTERNS:
        hits = sum(1 for p in patterns if p.search(text))
        if hits > best_hits:
            best_key, best_hits = key, hits
    return best_key


# -----------------------------------------------------------------------------
# Terminos emergentes
# -----------------------------------------------------------------------------
STOPWORDS: frozenset[str] = frozenset("""
a an the and or for to of in on with by is are was be this that it its i you your my we our
how what why which who vs after before from at as just new all into out up can do does should
will about than more most these those minutes days month step full one get got make made use
using used like it's i'm you're don't can't im dont thank thanks video videos really much
very so but not no have has had would could there their they them he she me us here now
also only even still some any every way thing things lot need want know see go going
2024 2025 2026 2027 de la el en que y
""".split())


def _terms(text: str) -> list[str]:
    text = re.sub(r"https?://\S+|www\.\S+", " ", text.lower())   # URLs y parametros utm
    words = [w for w in re.findall(r"[a-z0-9][a-z0-9\-\.]*[a-z0-9]|[a-z0-9]", text)
             if w not in STOPWORDS and len(w) > 1 and not w.isdigit()]
    bigrams = [f"{a} {b}" for a, b in zip(words, words[1:])]
    return words + bigrams


def emerging_terms(prev_docs: list[str], curr_docs: list[str], top_k: int = 8,
                   min_count: int = 6, prior_strength: float = 500.0
                   ) -> dict[str, list[dict[str, float | str | int]]]:
    """Log-odds ratio con prior de Dirichlet informativo. z > 0 => gana peso en curr.
    Cuenta presencia por documento (no frecuencia) para que un titulo repetitivo no domine."""
    c_prev = Counter(t for d in prev_docs for t in set(_terms(d)))
    c_curr = Counter(t for d in curr_docs for t in set(_terms(d)))
    background = c_prev + c_curr
    n_bg = sum(background.values())
    n_prev, n_curr = sum(c_prev.values()), sum(c_curr.values())

    rows: list[dict[str, float | str | int]] = []
    for term, total in background.items():
        if total < min_count:
            continue
        a_w = prior_strength * total / n_bg
        y_c, y_p = c_curr[term], c_prev[term]
        delta = (math.log((y_c + a_w) / (n_curr + prior_strength - y_c - a_w))
                 - math.log((y_p + a_w) / (n_prev + prior_strength - y_p - a_w)))
        var = 1.0 / (y_c + a_w) + 1.0 / (y_p + a_w)
        rows.append({
            "term": term,
            "z": round(delta / math.sqrt(var), 2),
            "prev_per_100": round(100 * y_p / max(len(prev_docs), 1), 1),
            "curr_per_100": round(100 * y_c / max(len(curr_docs), 1), 1),
        })

    def pick(ordered: list[dict[str, float | str | int]]) -> list[dict[str, float | str | int]]:
        """Descarta terminos redundantes: un unigrama con los mismos conteos que un bigrama
        que lo contiene ('agents' vs 'ai agents') aporta la misma senal."""
        chosen: list[dict[str, float | str | int]] = []
        for r in ordered:
            words = set(str(r["term"]).split())
            redundant = any(
                (words <= set(str(c["term"]).split()) or set(str(c["term"]).split()) <= words)
                and c["prev_per_100"] == r["prev_per_100"] and c["curr_per_100"] == r["curr_per_100"]
                for c in chosen
            )
            if not redundant:
                chosen.append(r)
            if len(chosen) == top_k:
                break
        return chosen

    rising = sorted(rows, key=lambda r: (-float(r["z"]), -len(str(r["term"]))))
    declining = sorted(rows, key=lambda r: (float(r["z"]), -len(str(r["term"]))))
    return {"rising": pick(rising), "declining": pick(declining)}


# -----------------------------------------------------------------------------
# Citas representativas
# -----------------------------------------------------------------------------
_UNSAFE = re.compile(r"https?://|www\.|@\w|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|\$\$|[\w.+-]+@[\w-]+\.\w+")
# Las citas se publican en el sitio: fuera groserias y estereotipos nacionales/etnicos.
_BLOCKLIST = re.compile(
    r"\b(fuck\w*|shit\w*|bitch\w*|damn|crap|ass|asshole|wtf|stfu|retard\w*|idiot\w*|stupid|"
    r"nigerian|indian|chinese|russian|african|mexican)\b|\*", re.IGNORECASE)
_TOPICAL = re.compile(r"\b(ai|agents?|agentic|automat\w*|llms?|gpt|chatgpt|claude|n8n|workflows?|bots?|robots?|models?)\b",
                      re.IGNORECASE)


def pick_quotes(candidates: list[dict[str, Any]], k: int = 2) -> list[dict[str, Any]]:
    """Comentarios mas votados con tono claro (|compound| >= 0.5), 40-180 caracteres, en
    ingles, sobre el topico y sin URLs, menciones, telefonos, correos ni groserias.
    Sin autor: solo texto + likes."""
    ok = [
        c for c in candidates
        if 40 <= len(c["text"]) <= 180 and abs(c["compound"]) >= 0.5
        and not _UNSAFE.search(c["text"]) and not _BLOCKLIST.search(c["text"])
        and _TOPICAL.search(c["text"]) and "\n" not in c["text"].strip()
    ]
    ok.sort(key=lambda c: c["likes"], reverse=True)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for c in ok:
        key = c["text"].lower()[:60]
        if key in seen:
            continue
        seen.add(key)
        # la UI pone sus propias comillas: quitar las que ya trae el comentario
        text = c["text"].strip().strip('"“”\'').strip()
        out.append({"text": text, "likes": c["likes"], "compound": round(c["compound"], 3)})
        if len(out) == k:
            break
    return out
