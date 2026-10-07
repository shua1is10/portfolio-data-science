"""
stats.py
Estadistica no parametrica en stdlib. Las metricas de YouTube son muy asimetricas
(cola pesada), por eso todo se resume con medianas y se contrasta con pruebas de rangos.
"""

from __future__ import annotations

import math
import random
from typing import Sequence


def median(xs: Sequence[float]) -> float:
    if not xs:
        return float("nan")
    s = sorted(xs)
    n, mid = len(s), len(s) // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2


def quantile(xs: Sequence[float], q: float) -> float:
    """Cuantil con interpolacion lineal (tipo 7, como numpy por defecto)."""
    s = sorted(xs)
    if not s:
        return float("nan")
    pos = (len(s) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def mean(xs: Sequence[float]) -> float:
    return sum(xs) / len(xs) if xs else float("nan")


def pct_change(new: float, old: float) -> float:
    return (new / old - 1) * 100 if old else float("nan")


def bootstrap_median_change(prev: Sequence[float], curr: Sequence[float],
                            resamples: int, rng: random.Random) -> tuple[float, float]:
    """IC 95% (percentil) del cambio % de la mediana curr vs prev."""
    deltas: list[float] = []
    for _ in range(resamples):
        mp = median(rng.choices(prev, k=len(prev)))
        mc = median(rng.choices(curr, k=len(curr)))
        if mp:
            deltas.append((mc / mp - 1) * 100)
    deltas.sort()
    return quantile(deltas, 0.025), quantile(deltas, 0.975)


def _ranks(xs: Sequence[float]) -> list[float]:
    """Rangos promedio (empates comparten rango)."""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    ranks = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def mann_whitney_u(a: Sequence[float], b: Sequence[float]) -> tuple[float, float]:
    """U de Mann-Whitney bilateral, aproximacion normal con correccion por empates.
    Devuelve (U_a, p_value)."""
    n1, n2 = len(a), len(b)
    if n1 == 0 or n2 == 0:
        return float("nan"), float("nan")
    combined = list(a) + list(b)
    ranks = _ranks(combined)
    r1 = sum(ranks[:n1])
    u1 = r1 - n1 * (n1 + 1) / 2
    mu = n1 * n2 / 2
    n = n1 + n2
    ties: dict[float, int] = {}
    for v in combined:
        ties[v] = ties.get(v, 0) + 1
    tie_term = sum(t ** 3 - t for t in ties.values()) / (n * (n - 1))
    sigma = math.sqrt(n1 * n2 / 12 * ((n + 1) - tie_term))
    if sigma == 0:
        return u1, 1.0
    z = (u1 - mu - math.copysign(0.5, u1 - mu)) / sigma
    return u1, math.erfc(abs(z) / math.sqrt(2))


def cliffs_delta(a: Sequence[float], b: Sequence[float]) -> float:
    """Tamano de efecto no parametrico en [-1, 1]; positivo => b tiende a ser mayor que a.
    |d| < 0.147 despreciable, < 0.33 pequeno, < 0.474 mediano, resto grande (Romano et al.)."""
    u_a, _ = mann_whitney_u(a, b)
    return 1 - 2 * u_a / (len(a) * len(b)) if a and b else float("nan")


def spearman(x: Sequence[float], y: Sequence[float]) -> float:
    if len(x) < 3:
        return float("nan")
    rx, ry = _ranks(x), _ranks(y)
    mx, my = mean(rx), mean(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    vx = math.sqrt(sum((a - mx) ** 2 for a in rx))
    vy = math.sqrt(sum((b - my) ** 2 for b in ry))
    return cov / (vx * vy) if vx and vy else float("nan")


def two_proportion_z(x1: int, n1: int, x2: int, n2: int) -> float:
    """p-value bilateral de la diferencia de proporciones (pooled)."""
    if not n1 or not n2:
        return float("nan")
    p = (x1 + x2) / (n1 + n2)
    se = math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    if se == 0:
        return 1.0
    z = (x2 / n2 - x1 / n1) / se
    return math.erfc(abs(z) / math.sqrt(2))


def benjamini_hochberg(pvalues: dict[str, float]) -> dict[str, float]:
    """q-values de Benjamini-Hochberg (control de la tasa de falsos descubrimientos)
    para una familia de pruebas. Los NaN se ignoran."""
    items = sorted(((k, p) for k, p in pvalues.items() if p == p), key=lambda kv: kv[1])
    m = len(items)
    q: dict[str, float] = {}
    running = 1.0
    for rank in range(m, 0, -1):
        key, p = items[rank - 1]
        running = min(running, p * m / rank)
        q[key] = running
    return q
