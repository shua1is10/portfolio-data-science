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

export interface CommentMix {
  n: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: Num;
  neutral_pct: Num;
  negative_pct: Num;
}

export interface PeriodKpis {
  videos: number;
  channels: number;
  median_age_days: Num;
  median_views: Num;
  median_daily_velocity: Num;
  median_engagement_ratio: Num;
  median_like_rate: Num;
  median_comment_rate: Num;
  mean_sentiment_index: Num;
  median_duration_s: Num;
  format_share: Record<"short" | "mid" | "long", number>;
  comments: CommentMix;
}

export interface MedianComparison {
  n_prev: number;
  n_curr: number;
  median_prev: Num;
  median_curr: Num;
  change_pct: Num;
  ci95: [Num, Num];
  p_value: Num;
  q_value: Num;
  cliffs_delta: Num;
}

export interface FormatSummary {
  key: "short" | "mid" | "long";
  label: string;
  n_prev: number;
  n_curr: number;
  share_prev: number;
  share_curr: number;
  share_p_value: Num;
  share_q_value: Num;
  engagement: MedianComparison;
  median_velocity_prev: Num;
  median_velocity_curr: Num;
  median_rvi_prev: Num;
  median_rvi_curr: Num;
  mean_sentiment_prev: Num;
  mean_sentiment_curr: Num;
}

export interface CategorySummary {
  key: string;
  label: string;
  n_prev: number;
  n_curr: number;
  share_prev: number;
  share_curr: number;
  share_p_value: Num;
  share_q_value: Num;
  median_engagement_prev: Num;
  median_engagement_curr: Num;
  median_rvi_prev: Num;
  median_rvi_curr: Num;
  mean_sentiment_prev: Num;
  mean_sentiment_curr: Num;
  negative_share_prev: Num;
  negative_share_curr: Num;
  positive_share_prev: Num;
  positive_share_curr: Num;
  negative_p_value: Num;
  negative_q_value: Num;
  comments_scored_prev: number;
  comments_scored_curr: number;
}

export interface Correlation {
  x: string;
  y: string;
  label: string;
  prev: { rho: Num; n: number };
  curr: { rho: Num; n: number };
  all: { rho: Num; n: number };
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
  prev_per_100: number;
  curr_per_100: number;
}

export interface TermShifts {
  rising: TermShift[];
  declining: TermShift[];
}

export interface Quote {
  text: string;
  likes: number;
  compound: number;
}

export interface PromoPeriod {
  comments: number;
  videos: number;
  video_share: Num;
  comment_share: Num;
  by_brand: Record<string, number>;
  by_category: Record<string, number>;
}

export interface InsightsSummary {
  meta: {
    topic: string;
    data_source: string;
    fetched_at: string;
    snapshot: string;
    periods: [PeriodMeta, PeriodMeta];
    queries: string[];
    results_per_query_month: number | null;
    generated_at: string;
  };
  audit: Record<string, number>;
  kpis: Record<PeriodKey, PeriodKpis>;
  overall: Record<"engagement" | "like_rate" | "comment_rate" | "sentiment" | "duration", MedianComparison>;
  comment_tests: { negative_p: Num; positive_p: Num; negative_q: Num; positive_q: Num };
  age_bias: {
    median_age_days: [Num, Num];
    raw_views_change_pct: Num;
    velocity_change_pct: Num;
    rho_age_velocity_curr: Num;
  };
  robustness: {
    rho_age_engagement_curr_mature: Num;
    rho_age_engagement_prev: Num;
    engagement_change_all_pct: Num;
    engagement_change_curr_aged_120d_pct: Num;
    n_curr_aged_120d: number;
  };
  formats: FormatSummary[];
  duration_bins: {
    label: string;
    n_prev: number;
    n_curr: number;
    median_engagement_prev: Num;
    median_engagement_curr: Num;
    median_velocity_prev: Num;
    median_velocity_curr: Num;
    median_rvi_all: Num;
    n_rvi_all: number;
  }[];
  categories: CategorySummary[];
  correlations: Correlation[];
  emerging_terms: { titles: TermShifts; comments: TermShifts };
  quotes: Record<PeriodKey, { positive: Quote[]; negative: Quote[] }>;
  promotional_comments: {
    prev: PromoPeriod;
    curr: PromoPeriod;
    brands: string[];
    video_share_p_value: Num;
    video_share_q_value: Num;
  };
  tests_in_family: number;
  thresholds: {
    maturity_days: number;
    age_band_days: number;
    min_views: number;
    min_group_n: number;
    min_comments_for_sentiment: number;
    negative_threshold: number;
    positive_threshold: number;
    bootstrap_resamples: number;
    alpha: number;
  };
  highlights: Highlight[];
  recommendations: Recommendation[];
}

/* ── Compact per-video rows (public/data/.../videos.json) ─────────────────── */

/** [period, month, category, format, durationS, views, dailyVelocity, engagementRatio,
 *  sentimentIndex, rviQuintile, ageDays, positiveComments, neutralComments, negativeComments] */
export type VideoTuple = [
  0 | 1, number, number, number, number, number, Num, Num, Num, number, number, number, number, number,
];

export interface VideosPayload {
  fields: string[];
  categories: { key: string; label: string }[];
  formats: { key: string; label: string }[];
  durationBins: { label: string; min: number; max: number | null }[];
  sentimentBuckets: string[];
  rviQuintileEdges: number[];
  rows: VideoTuple[];
}

export interface Video {
  period: PeriodKey;
  month: number;
  category: number;
  format: number;
  durationS: number;
  views: number;
  dailyVelocity: Num;
  engagementRatio: Num;
  sentimentIndex: Num;
  rviQuintile: number;
  ageDays: number;
  positiveComments: number;
  neutralComments: number;
  negativeComments: number;
}

export function decodeVideos(payload: VideosPayload): Video[] {
  return payload.rows.map(
    ([p, month, category, format, durationS, views, dailyVelocity, engagementRatio, sentimentIndex,
      rviQuintile, ageDays, positiveComments, neutralComments, negativeComments]) => ({
      period: p === 0 ? "prev" : "curr",
      month,
      category,
      format,
      durationS,
      views,
      dailyVelocity,
      engagementRatio,
      sentimentIndex,
      rviQuintile,
      ageDays,
      positiveComments,
      neutralComments,
      negativeComments,
    }),
  );
}
