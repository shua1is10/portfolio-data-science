"""
nlp.py
NLP ligero y sin dependencias:
  - score_sentiment: lexico de valencia estilo VADER (negacion, intensificadores, "but").
  - classify_category: clasificador de subtopicos por reglas sobre titulo + tags.
  - emerging_terms: log-odds ratio con prior de Dirichlet informativo (Monroe et al., 2008)
    para detectar terminos que ganan/pierden peso entre periodos.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Iterable

from config import CATEGORIES, OTHER_CATEGORY

# -----------------------------------------------------------------------------
# Sentimiento
# -----------------------------------------------------------------------------
LEXICON: dict[str, float] = {
    # positivos
    "amazing": 3.1, "awesome": 3.1, "great": 3.0, "love": 3.2, "excellent": 3.2, "best": 3.0,
    "helpful": 2.3, "useful": 2.0, "clear": 1.6, "thanks": 1.9, "thank": 1.9, "good": 1.9,
    "brilliant": 2.9, "perfect": 2.9, "fantastic": 3.0, "saved": 1.8, "finally": 1.0,
    "incredible": 2.8, "insightful": 2.4, "easy": 1.6, "nice": 1.8, "works": 1.2,
    "subscribed": 1.6, "gem": 2.4, "underrated": 1.8, "valuable": 2.2, "impressive": 2.6,
    "fun": 2.0, "cool": 1.6, "legend": 2.2, "solid": 1.6, "recommend": 1.8,
    # negativos
    "clickbait": -2.4, "terrible": -3.0, "garbage": -3.1, "waste": -2.4, "misleading": -2.5,
    "scary": -2.2, "dangerous": -2.3, "ruining": -2.6, "overhyped": -2.0, "hype": -0.9,
    "boring": -2.0, "useless": -2.6, "wrong": -2.0, "bad": -2.5, "worst": -3.1, "hate": -2.7,
    "scam": -3.0, "fake": -2.1, "annoying": -2.1, "confusing": -1.8, "outdated": -1.4,
    "disappointed": -2.2, "lazy": -1.8, "slop": -2.3, "spam": -2.2, "broken": -2.0,
    "unemployed": -1.6, "worried": -1.7, "creepy": -2.0, "stolen": -2.4, "theft": -2.6,
    "long": -0.6, "fail": -2.0, "fails": -2.0, "problem": -1.3,
}
BOOSTERS: dict[str, float] = {
    "very": 0.293, "really": 0.293, "super": 0.293, "extremely": 0.293, "so": 0.2,
    "incredibly": 0.293, "absolutely": 0.293, "totally": 0.25, "honestly": 0.15,
}
NEGATORS: frozenset[str] = frozenset({
    "not", "no", "never", "isn't", "dont", "don't", "doesn't", "didn't", "can't",
    "cant", "won't", "hardly", "nothing", "without",
})
NEGATION_SCALAR: float = -0.74
ALPHA: float = 15.0   # normalizacion del compound (misma constante que VADER)

_TOKEN = re.compile(r"[a-z']+|!")


def _tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def score_sentiment(text: str) -> float:
    """Devuelve un compound en [-1, 1]."""
    toks = _tokens(text)
    words = [t for t in toks if t != "!"]
    scores: list[float] = []
    for i, w in enumerate(words):
        v = LEXICON.get(w)
        if v is None:
            continue
        # intensificadores hasta 2 tokens antes
        for back in (1, 2):
            if i - back >= 0 and words[i - back] in BOOSTERS:
                v += math.copysign(BOOSTERS[words[i - back]], v)
        # negacion en ventana de 3 tokens
        if any(words[j] in NEGATORS for j in range(max(0, i - 3), i)):
            v *= NEGATION_SCALAR
        scores.append(v)
    if not scores:
        return 0.0
    # contraste "but": lo que sigue pesa mas
    if "but" in words:
        but_idx = words.index("but")
        lex_positions = [i for i, w in enumerate(words) if w in LEXICON]
        scores = [s * (0.5 if pos < but_idx else 1.5) for s, pos in zip(scores, lex_positions)]
    total = sum(scores)
    total += math.copysign(min(toks.count("!"), 4) * 0.292, total) if total else 0.0
    return total / math.sqrt(total * total + ALPHA)


# -----------------------------------------------------------------------------
# Clasificacion de subtopicos
# -----------------------------------------------------------------------------
def classify_category(title: str, tags: Iterable[str] = ()) -> str:
    """Regla: categoria con mas keywords presentes; empate -> orden de CATEGORIES."""
    text = f" {title.lower()} {' '.join(tags).lower()} "
    best_key, best_hits = OTHER_CATEGORY[0], 0
    for key, _label, keywords in CATEGORIES:
        hits = sum(1 for kw in keywords if kw in text)
        if hits > best_hits:
            best_key, best_hits = key, hits
    return best_key


# -----------------------------------------------------------------------------
# Terminos emergentes
# -----------------------------------------------------------------------------
STOPWORDS: frozenset[str] = frozenset("""
a an the and or for to of in on with by is are was be this that it its i you your my we our
how what why which who vs after before from at as just new all into out up can do does should
will about than more most these those minutes days month step full in this 2025 2026 one
""".split())


def _terms(title: str) -> list[str]:
    words = [w for w in re.findall(r"[a-z0-9][a-z0-9\-]+", title.lower()) if w not in STOPWORDS]
    bigrams = [f"{a} {b}" for a, b in zip(words, words[1:])]
    return words + bigrams


def emerging_terms(prev_titles: list[str], curr_titles: list[str],
                   top_k: int = 8, min_count: int = 15, prior_strength: float = 500.0
                   ) -> dict[str, list[dict[str, float | str | int]]]:
    """Log-odds ratio con prior de Dirichlet informativo. z > 0 => gana peso en curr."""
    c_prev = Counter(t for title in prev_titles for t in _terms(title))
    c_curr = Counter(t for title in curr_titles for t in _terms(title))
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
            "prev_per_1k": round(1000 * y_p / max(len(prev_titles), 1), 1),
            "curr_per_1k": round(1000 * y_c / max(len(curr_titles), 1), 1),
        })
    def pick(ordered: list[dict[str, float | str | int]]) -> list[dict[str, float | str | int]]:
        """Descarta terminos redundantes: un unigrama con los mismos conteos que un bigrama
        que lo contiene ('stack' vs 'automation stack') aporta la misma senal."""
        chosen: list[dict[str, float | str | int]] = []
        for r in ordered:
            words = set(str(r["term"]).split())
            redundant = any(
                (words <= set(str(c["term"]).split()) or set(str(c["term"]).split()) <= words)
                and c["prev_per_1k"] == r["prev_per_1k"] and c["curr_per_1k"] == r["curr_per_1k"]
                for c in chosen
            )
            if not redundant:
                chosen.append(r)
            if len(chosen) == top_k:
                break
        return chosen

    # empates de z: el termino mas largo (bigrama) primero
    rising = sorted(rows, key=lambda r: (-float(r["z"]), -len(str(r["term"]))))
    declining = sorted(rows, key=lambda r: (float(r["z"]), -len(str(r["term"]))))
    return {"rising": pick(rising), "declining": pick(declining)}
