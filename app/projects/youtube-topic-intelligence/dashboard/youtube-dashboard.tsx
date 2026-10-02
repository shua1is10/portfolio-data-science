"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Gauge, Loader2, MessageCircleHeart, TrendingUp } from "lucide-react";
import { FadeUp } from "@/components/ui/animate";
import { decodeVideos, type InsightsSummary, type Video, type VideosPayload } from "../types";
import {
  applyFilters, byPeriod, durationBins, kpis, monthly, pctChange, quintileEdges, sentimentMatrix,
  topicShares, visiblePeriods, type Filters, type MatrixMetric,
} from "../components/aggregations";
import { DataSourceNotice } from "../components/data-source-notice";
import { FilterBar } from "../components/filters";
import { FormatEngagementChart } from "../components/format-engagement-chart";
import { fmtDate, fmtDelta, fmtNum } from "../components/format";
import { KpiCard } from "../components/kpi-card";
import { SentimentMatrix } from "../components/sentiment-matrix";
import { TopicShareChart } from "../components/topic-share-chart";
import { TrendCharts } from "../components/trend-charts";
import { VIZ_VARS } from "../components/viz-theme";

const DATA_URL = "/data/youtube-topic-intelligence/videos.json";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: VideosPayload; videos: Video[]; eerEdges: number[] };

export function YouTubeDashboard({ meta, maturityDays }: { meta: InsightsSummary["meta"]; maturityDays: number }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filters, setFilters] = useState<Filters>({ period: "compare", format: "all", category: "all" });
  const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>("eer");
  const [prevP, currP] = meta.periods;

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<VideosPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        const videos = decodeVideos(payload);
        const eerEdges = quintileEdges(videos.flatMap((v) => (v.eer === null ? [] : [v.eer])));
        setState({ status: "ready", payload, videos, eerEdges });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    if (state.status !== "ready") return null;
    const { payload, videos, eerEdges } = state;
    const filtered = applyFilters(videos, filters);
    const visible = visiblePeriods(filters.period);
    const inView = filtered.filter((v) => visible.includes(v.period));
    const prevK = kpis(byPeriod(filtered, "prev"));
    const currK = kpis(byPeriod(filtered, "curr"));
    return {
      payload,
      visible,
      inView,
      prevK,
      currK,
      viewK: kpis(inView),
      monthly: monthly(filtered),
      bins: durationBins(filtered, payload.durationBins),
      // topic shares ignore the subtopic filter: one subtopic's share of itself is 100%
      shares: topicShares(applyFilters(videos, { ...filters, category: "all" }), payload.categories),
      matrix: sentimentMatrix(inView, matrixMetric, eerEdges),
    };
  }, [state, filters, matrixMetric]);

  return (
    <div className={`${VIZ_VARS} px-4 sm:px-6 pt-12 sm:pt-16 pb-24`}>
      <div className="max-w-6xl mx-auto">
        {/* ── Header ───────────────────────────────────────── */}
        <FadeUp>
          <Link
            href="/projects/youtube-topic-intelligence"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071e3] hover:underline no-underline"
          >
            <ArrowLeft className="w-4 h-4" /> Case study
          </Link>
          <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
                Interactive Dashboard · {meta.topic}
              </p>
              <h1 className="mt-2 text-[clamp(1.8rem,4vw,2.75rem)] font-bold tracking-[-0.035em] leading-tight text-[#1d1d1f] dark:text-white">
                YouTube Topic Intelligence
              </h1>
            </div>
            <p className="text-[12px] text-[#86868b]">
              {prevP.label} vs {currP.label} · metrics as of {fmtDate(meta.snapshot)}
            </p>
          </div>
          <DataSourceNotice isSynthetic={meta.is_synthetic} className="mt-5" />
        </FadeUp>

        {state.status === "loading" && (
          <div className="mt-16 flex items-center justify-center gap-2 text-[13px] text-[#86868b]" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading video-level data…
          </div>
        )}
        {state.status === "error" && (
          <div className="mt-16 rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-8 text-center" role="alert">
            <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">The dataset could not be loaded.</p>
            <p className="mt-1 text-[12.5px] text-[#86868b]">
              {DATA_URL} · {state.message}. Re-run the pipeline to regenerate it.
            </p>
          </div>
        )}

        {view && (
          <>
            {/* ── Filters ──────────────────────────────────── */}
            <div className="mt-8 xl:sticky xl:top-16 z-20 -mx-4 sm:mx-0 px-4 sm:px-3 py-3 rounded-none sm:rounded-3xl bg-white/80 dark:bg-black/70 backdrop-blur-xl border-y sm:border border-black/5 dark:border-white/10">
              <FilterBar
                value={filters}
                onChange={setFilters}
                formats={view.payload.formats}
                categories={view.payload.categories}
                prevLabel={prevP.label}
                currLabel={currP.label}
              />
            </div>

            {view.inView.length === 0 ? (
              <div className="mt-10 rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-10 text-center text-[14px] text-[#6e6e73] dark:text-[#a1a1a6]">
                No videos match this combination of filters.
              </div>
            ) : (
              <>
                {/* ── KPI scorecard ─────────────────────────── */}
                <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <KpiCard
                    icon={Clapperboard}
                    label="Total analyzed videos"
                    value={fmtNum(view.viewK.videos)}
                    sub={filters.period === "compare"
                      ? `${fmtNum(view.prevK.videos)} + ${fmtNum(view.currK.videos)} across both windows`
                      : "in the selected window"}
                  />
                  <KpiCard
                    icon={Gauge}
                    label="Median velocity (views/day)"
                    value={fmtNum(filters.period === "prev" ? view.prevK.medianVelocity : view.currK.medianVelocity)}
                    sub={filters.period === "compare"
                      ? `${currP.label}; ${prevP.label}: ${fmtNum(view.prevK.medianVelocity)}`
                      : `videos ≥ ${maturityDays} days old`}
                    note="Within-period only: videos from different years differ in age, so velocity is not compared across years."
                  />
                  <KpiCard
                    icon={MessageCircleHeart}
                    label="Average sentiment index"
                    value={fmtNum(view.viewK.sentiment, 1)}
                    sub={filters.period === "compare"
                      ? `${prevP.label} ${fmtNum(view.prevK.sentiment, 1)} → ${currP.label} ${fmtNum(view.currK.sentiment, 1)}`
                      : "scale −100 to +100, from comment text"}
                  />
                  <KpiCard
                    icon={TrendingUp}
                    label="YoY growth rate (uploads)"
                    value={fmtDelta(pctChange(view.currK.videos, view.prevK.videos))}
                    sub={`median EER ${fmtDelta(pctChange(view.currK.medianEer, view.prevK.medianEer))} YoY`}
                    note="Always current vs prior window, for the active format and subtopic."
                  />
                </div>

                {/* ── Temporal trend ────────────────────────── */}
                <div className="mt-4">
                  <TrendCharts data={view.monthly} visible={view.visible} prevLabel={prevP.label} currLabel={currP.label} />
                </div>

                {/* ── Format vs engagement · topic share ────── */}
                <div className="mt-4 grid lg:grid-cols-2 gap-4">
                  <FormatEngagementChart data={view.bins} visible={view.visible} prevLabel={prevP.label} currLabel={currP.label} />
                  <TopicShareChart data={view.shares} visible={view.visible} prevLabel={prevP.label} currLabel={currP.label} />
                </div>

                {/* ── Sentiment × performance ───────────────── */}
                <div className="mt-4">
                  <SentimentMatrix
                    matrix={view.matrix}
                    metric={matrixMetric}
                    onMetricChange={setMatrixMetric}
                    sentimentLabels={view.payload.sentimentBuckets}
                  />
                </div>

                <p className="mt-8 text-center text-[12px] text-[#86868b]">
                  How each metric is normalized, and which biases it controls for, is documented in the{" "}
                  <Link href="/projects/youtube-topic-intelligence#methodology" className="text-[#0071e3] hover:underline">
                    methodology section
                  </Link>.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
