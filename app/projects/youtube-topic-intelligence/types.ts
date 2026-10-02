/* Data contract for the YouTube Topic Intelligence pipeline.
 * Mirrors analytics/youtube-topic-intelligence/scripts/extract_and_process.py — any float the
 * pipeline could not compute (NaN) is serialized as null, hence the `| null` on statistics. */

export type PeriodKey = "prev" | "curr";
export type Num = number | null;

export interface PeriodMeta {
  key: PeriodKey;
  label: string;
  start: string;
  end: string;
}

export interface PeriodKpis {
  videos: number;
  median_age_days: Num;
  median_views: Num;
  median_daily_velocity: Num;
  median_eer: Num;
  mean_sentiment_index: Num;
  critical_comment_share: Num;
  shorts_share: Num;
}

export interface MedianComparison {
  n_prev: number;
  n_curr: number;
  median_prev: Num;
  median_curr: Num;
  change_pct: Num;
  ci95: [Num, Num];
  p_value: Num;
  cliffs_delta: Num;
}

export interface FormatSummary {
  key: "short" | "mid" | "long";
  label: string;
  share_prev: number;
  share_curr: number;
  eer: MedianComparison;
  median_rvi_prev: Num;
  median_rvi_curr: Num;
}

export interface CategorySummary {
  key: string;
  label: string;
  n_prev: number;
  n_curr: number;
  share_prev: number;
  share_curr: number;
  share_p_value: Num;
  median_eer_prev: Num;
  median_eer_curr: Num;
  median_rvi_curr: Num;
  mean_sentiment_prev: Num;
  mean_sentiment_curr: Num;
  critical_share_prev: Num;
  critical_share_curr: Num;
  positive_share_prev: Num;
  positive_share_curr: Num;
  critical_p_value: Num;
  comments_scored_prev: number;
  comments_scored_curr: number;
}

export interface Highlight {
  id: string;
  kicker: string;
  headline: string;
  detail: string;
  evidence: string;
  unit: string;
  bars: { label: string; prev: Num; curr: Num }[];
}

export interface Recommendation {
  audience: "Creators" | "Brands";
  title: string;
  body: string;
}

export interface TermShift {
  term: string;
  z: number;
  prev_per_1k: number;
  curr_per_1k: number;
}

export interface InsightsSummary {
  meta: {
    topic: string;
    data_source: string;
    is_synthetic: boolean;
    snapshot: string;
    periods: [PeriodMeta, PeriodMeta];
    queries: string[];
    generated_at: string;
    seed: number;
  };
  audit: Record<string, number>;
  kpis: Record<PeriodKey, PeriodKpis>;
  supply_growth_pct: Num;
  eer_overall: MedianComparison;
  age_bias: {
    median_age_days: [Num, Num];
    raw_views_change_pct: Num;
    velocity_change_pct: Num;
    rho_age_velocity_curr: Num;
  };
  robustness: {
    rho_age_eer_curr_mature: Num;
    rho_age_eer_prev: Num;
    eer_change_all_curr_pct: Num;
    eer_change_curr_aged_120d_pct: Num;
    n_curr_aged_120d: number;
  };
  formats: FormatSummary[];
  duration_bins: { label: string; n_prev: number; n_curr: number; median_eer_prev: Num; median_eer_curr: Num }[];
  categories: CategorySummary[];
  sentiment_performance: Record<PeriodKey, { rho_sentiment_eer: Num; rho_sentiment_rvi: Num }>;
  emerging_terms: { rising: TermShift[]; declining: TermShift[] };
  classifier_qa: { accuracy: number; other_rate: number } | null;
  thresholds: {
    maturity_days: number;
    age_band_days: number;
    min_views: number;
    critical_threshold: number;
    bootstrap_resamples: number;
  };
  highlights: Highlight[];
  recommendations: Recommendation[];
}

/* ── Compact per-video rows (public/data/.../videos.json) ─────────────────── */

/** [period, month, category, format, durationS, dailyVelocity, eer, sentimentIndex, rviQuintile, ageDays] */
export type VideoTuple = [0 | 1, number, number, number, number, Num, Num, Num, number, number];

export interface VideosPayload {
  fields: string[];
  categories: { key: string; label: string }[];
  formats: { key: string; label: string }[];
  durationBins: { label: string; min: number; max: number | null }[];
  sentimentBuckets: string[];
  rviQuintileEdges: number[];
  isSynthetic: boolean;
  rows: VideoTuple[];
}

export interface Video {
  period: PeriodKey;
  month: number;
  category: number;
  format: number;
  durationS: number;
  dailyVelocity: Num;
  eer: Num;
  sentimentIndex: Num;
  rviQuintile: number;
  ageDays: number;
}

export function decodeVideos(payload: VideosPayload): Video[] {
  return payload.rows.map(([p, month, category, format, durationS, dailyVelocity, eer, sentimentIndex, rviQuintile, ageDays]) => ({
    period: p === 0 ? "prev" : "curr",
    month,
    category,
    format,
    durationS,
    dailyVelocity,
    eer,
    sentimentIndex,
    rviQuintile,
    ageDays,
  }));
}
