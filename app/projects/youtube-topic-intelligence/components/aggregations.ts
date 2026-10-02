/* Pure, client-side aggregations over the decoded video rows. Kept free of React so the
 * dashboard's useMemo blocks stay one-liners and the math is testable in isolation.
 * Medians throughout: YouTube metrics are heavy-tailed, means would chase outliers. */

import type { Num, PeriodKey, Video, VideosPayload } from "../types";

export type PeriodFilter = PeriodKey | "compare";

export interface Filters {
  period: PeriodFilter;
  format: number | "all";
  category: number | "all";
}

export function median(xs: number[]): Num {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(xs: number[]): Num {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function present(xs: Num[]): number[] {
  return xs.filter((x): x is number => x !== null);
}

function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) out[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation (average ranks for ties). */
export function spearman(x: number[], y: number[]): Num {
  if (x.length < 3) return null;
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = (x.length + 1) / 2;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < x.length; i++) {
    cov += (rx[i] - mx) * (ry[i] - mx);
    vx += (rx[i] - mx) ** 2;
    vy += (ry[i] - mx) ** 2;
  }
  return vx && vy ? cov / Math.sqrt(vx * vy) : null;
}

/** Applies the format/category filters only — the period filter decides which series render. */
export function applyFilters(videos: Video[], f: Filters): Video[] {
  return videos.filter(
    (v) => (f.format === "all" || v.format === f.format) && (f.category === "all" || v.category === f.category),
  );
}

export function byPeriod(videos: Video[], p: PeriodKey): Video[] {
  return videos.filter((v) => v.period === p);
}

export function visiblePeriods(p: PeriodFilter): PeriodKey[] {
  return p === "compare" ? ["prev", "curr"] : [p];
}

/* ── KPIs ──────────────────────────────────────────────────────────────── */
export interface Kpis {
  videos: number;
  medianVelocity: Num;
  medianEer: Num;
  sentiment: Num;
}

export function kpis(videos: Video[]): Kpis {
  return {
    videos: videos.length,
    medianVelocity: median(present(videos.map((v) => v.dailyVelocity))),
    medianEer: median(present(videos.map((v) => v.eer))),
    sentiment: mean(present(videos.map((v) => v.sentimentIndex))),
  };
}

export function pctChange(curr: Num, prev: Num): Num {
  return curr === null || prev === null || prev === 0 ? null : (curr / prev - 1) * 100;
}

/* ── Monthly trend ─────────────────────────────────────────────────────── */
export interface MonthPoint {
  month: number;
  prevUploads: number;
  currUploads: number;
  prevEer: Num;
  currEer: Num;
}

export function monthly(videos: Video[]): MonthPoint[] {
  return Array.from({ length: 9 }, (_, i) => {
    const m = i + 1;
    const pm = videos.filter((v) => v.month === m && v.period === "prev");
    const cm = videos.filter((v) => v.month === m && v.period === "curr");
    return {
      month: m,
      prevUploads: pm.length,
      currUploads: cm.length,
      prevEer: median(present(pm.map((v) => v.eer))),
      currEer: median(present(cm.map((v) => v.eer))),
    };
  });
}

/* ── Duration bins ─────────────────────────────────────────────────────── */
export interface BinPoint {
  label: string;
  prevEer: Num;
  currEer: Num;
  prevN: number;
  currN: number;
}

export function durationBins(videos: Video[], bins: VideosPayload["durationBins"]): BinPoint[] {
  return bins.map((b) => {
    const inBin = (v: Video) => v.durationS > b.min && (b.max === null || v.durationS <= b.max);
    const pv = present(videos.filter((v) => v.period === "prev" && inBin(v)).map((v) => v.eer));
    const cv = present(videos.filter((v) => v.period === "curr" && inBin(v)).map((v) => v.eer));
    return { label: b.label, prevEer: median(pv), currEer: median(cv), prevN: pv.length, currN: cv.length };
  });
}

/* ── Topic share ───────────────────────────────────────────────────────── */
export interface SharePoint {
  label: string;
  prevShare: number;
  currShare: number;
  prevN: number;
  currN: number;
}

export function topicShares(videos: Video[], categories: VideosPayload["categories"]): SharePoint[] {
  const prev = byPeriod(videos, "prev");
  const curr = byPeriod(videos, "curr");
  return categories
    .map((c, i) => {
      const pn = prev.filter((v) => v.category === i).length;
      const cn = curr.filter((v) => v.category === i).length;
      return {
        label: c.label,
        prevShare: prev.length ? (pn / prev.length) * 100 : 0,
        currShare: curr.length ? (cn / curr.length) * 100 : 0,
        prevN: pn,
        currN: cn,
      };
    })
    .sort((a, b) => b.currShare - a.currShare);
}

/* ── Sentiment × performance matrix ────────────────────────────────────── */
export type MatrixMetric = "eer" | "rvi";

export interface Matrix {
  /** cells[quintile][sentimentBucket] = % of that tone bucket's videos in the quintile.
   *  Columns sum to 100%; with no relationship every cell would sit near 20%. */
  cells: number[][];
  counts: number[][];
  columnTotals: number[];
  total: number;
  /** Spearman ρ between sentiment index and the selected metric (raw values, not quintiles). */
  rho: Num;
}

const SENTIMENT_EDGES = [-30, -5, 5, 30]; // mirrors config.SENTIMENT_BUCKETS

export function sentimentBucket(s: number): number {
  return SENTIMENT_EDGES.filter((e) => s >= e).length;
}

/** Global quintile cut points, computed once over the full dataset so the grid's rows
 *  mean the same thing under every filter. */
export function quintileEdges(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => {
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  });
}

export function sentimentMatrix(videos: Video[], metric: MatrixMetric, eerEdges: number[]): Matrix {
  const quintileOf = (v: Video): number | null => {
    if (metric === "rvi") return v.rviQuintile >= 0 ? v.rviQuintile : null;
    return v.eer === null ? null : eerEdges.filter((e) => (v.eer as number) > e).length;
  };

  const counts = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const v of videos) {
    const q = quintileOf(v);
    if (v.sentimentIndex === null || q === null) continue;
    counts[q][sentimentBucket(v.sentimentIndex)] += 1;
    xs.push(v.sentimentIndex);
    // ρ on the underlying metric: RVI is only shipped as a quintile, so it ranks on that
    ys.push(metric === "eer" ? (v.eer as number) : q);
  }
  const columnTotals = [0, 1, 2, 3, 4].map((c) => counts.reduce((acc, row) => acc + row[c], 0));
  return {
    counts,
    columnTotals,
    cells: counts.map((row) => row.map((n, c) => (columnTotals[c] ? (n / columnTotals[c]) * 100 : 0))),
    total: xs.length,
    rho: spearman(xs, ys),
  };
}
