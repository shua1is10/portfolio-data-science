import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Clock, Filter, EyeOff, Scissors, ShieldAlert, Gauge, Languages,
  Megaphone, Clapperboard, TrendingUp, TrendingDown, Quote as QuoteIcon, ThumbsUp,
} from "lucide-react";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";
import { cn } from "@/lib/utils";
import { loadSummary } from "./load-summary";
import type { PeriodKey, Quote, TermShifts } from "./types";
import { DataSourceNotice } from "./components/data-source-notice";
import { HighlightCard } from "./components/highlight-card";
import { PipelineDiagram } from "./components/pipeline-diagram";
import { SectionHeading } from "./components/section-heading";
import { fmtCompact, fmtDate, fmtDelta, fmtNum, fmtPct } from "./components/format";
import { VIZ_VARS } from "./components/viz-theme";

export const metadata: Metadata = {
  title: "YouTube Topic Intelligence — Joshua Sánchez",
  description:
    "Case study on real YouTube Data API data: how the AI agents & automation niche shifted year over year — format, engagement, comment integrity and vocabulary — with age-normalized metrics, VADER sentiment and FDR-corrected inference.",
};

const DASHBOARD = "/projects/youtube-topic-intelligence/dashboard";

const fmtQ = (q: number | null | undefined) =>
  q === null || q === undefined ? "—" : q < 0.001 ? "q < 0.001" : `q = ${q.toFixed(3)}`;

function TermList({ label, shifts, tone }: { label: string; shifts: TermShifts; tone: "titles" | "comments" }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white">{label}</p>
      {([["Rising", shifts.rising], ["Fading", shifts.declining]] as const).map(([kind, terms]) => (
        <div key={kind} className="mt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">{kind}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {terms.slice(0, 6).map((t) => (
              <li
                key={t.term}
                title={`In ${t.prev_per_100}% → ${t.curr_per_100}% of ${tone === "titles" ? "titles" : "videos' comment sections"}`}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[12px] font-medium",
                  kind === "Rising"
                    ? "bg-[#0071e3]/10 text-[#0058b0] dark:text-[#66b2ff]"
                    : "bg-black/5 dark:bg-white/10 text-[#515154] dark:text-[#a1a1a6]",
                )}
              >
                {t.term} <span className="tabular-nums opacity-70">z {t.z > 0 ? "+" : "−"}{Math.abs(t.z).toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function QuoteCard({ quote, tone, period }: { quote: Quote; tone: "positive" | "negative"; period: string }) {
  return (
    <figure className="h-full flex flex-col rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
      <QuoteIcon className={cn("w-5 h-5", tone === "positive" ? "text-[#0071e3]" : "text-[#e34948]")} aria-hidden />
      <blockquote className="mt-3 text-[14.5px] leading-relaxed text-[#1d1d1f] dark:text-white">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <figcaption className="mt-auto pt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#86868b]">
        <span className="font-semibold">{period} · {tone === "positive" ? "positive" : "negative"} tone</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <ThumbsUp className="w-3 h-3" aria-hidden /> {fmtCompact(quote.likes)}
        </span>
        <span className="tabular-nums">VADER {quote.compound > 0 ? "+" : "−"}{Math.abs(quote.compound).toFixed(2)}</span>
      </figcaption>
    </figure>
  );
}

export default function YouTubeTopicIntelligenceCaseStudy() {
  const s = loadSummary();
  const [prevP, currP] = s.meta.periods;
  const label: Record<PeriodKey, string> = { prev: prevP.label, curr: currP.label };
  const totalVideos = s.kpis.prev.videos + s.kpis.curr.videos;
  const organicComments = s.kpis.prev.comments.n + s.kpis.curr.comments.n;
  const categories = s.categories.filter((c) => c.key !== "other");
  const shareShifts = [...categories].sort(
    (a, b) => (b.share_curr - b.share_prev) - (a.share_curr - a.share_prev),
  );
  const fm = Object.fromEntries(s.formats.map((f) => [f.key, f]));
  const rob = s.robustness;
  const promo = s.promotional_comments;
  const a = s.audit;

  const quotes = (["prev", "curr"] as const).flatMap((p) =>
    (["positive", "negative"] as const).flatMap((tone) =>
      s.quotes[p][tone].slice(0, 1).map((q) => ({ q, tone, period: label[p] })),
    ),
  );

  const SCOPE = [
    { label: "Topic", value: s.meta.topic },
    { label: "Windows", value: `${prevP.label} vs ${currP.label}` },
    { label: "Sample", value: `${fmtNum(totalVideos)} videos · ${fmtNum(organicComments)} comments` },
    { label: "Collected", value: fmtDate(s.meta.fetched_at.slice(0, 10)) },
  ];

  const sig = (q: number | null | undefined) => q !== null && q !== undefined && q < s.thresholds.alpha;
  const significantShares = categories.filter((c) => sig(c.share_q_value));
  const changes: string[] = [];
  if (sig(s.overall.duration.q_value)) {
    changes.push(`what YouTube surfaces for the topic got ${(s.overall.duration.change_pct ?? 0) > 0 ? "longer" : "shorter"}`);
  }
  const shortEng = fm.short.engagement.change_pct ?? 0;
  const longEng = fm.long.engagement.change_pct ?? 0;
  if (sig(fm.short.engagement.q_value) || sig(fm.long.engagement.q_value)) {
    changes.push(`interaction moved toward ${shortEng > longEng ? "shorter" : "longer"} formats`);
  }
  if (sig(promo.video_share_q_value)) {
    changes.push(`comment sections got ${(promo.curr.video_share ?? 0) < (promo.prev.video_share ?? 0) ? "cleaner" : "noisier"}`);
  }
  const fromTerm = s.emerging_terms.titles.declining[0]?.term;
  const toTerm = s.emerging_terms.titles.rising[0]?.term;
  if (fromTerm && toTerm) changes.push(`the conversation moved from “${fromTerm}” to “${toTerm}”`);
  const changeSentence = changes.length
    ? `${changes.slice(0, -1).join(", ")}${changes.length > 1 ? ", and " : ""}${changes[changes.length - 1]}.`
    : "No year-over-year shift survives correction for multiple tests.";

  const ageSensitive = Math.abs(rob.rho_age_engagement_curr_mature ?? 0) >= 0.15;
  const olderHigher = (rob.rho_age_engagement_curr_mature ?? 0) > 0;

  const BIASES = [
    {
      icon: Clock,
      title: "Age confound",
      body: `With one snapshot, period and video age are almost perfectly confounded: median age is ${fmtNum(s.age_bias.median_age_days[0])} days for last year's videos vs ${fmtNum(s.age_bias.median_age_days[1])} for this year's. Raw views move ${fmtDelta(s.age_bias.raw_views_change_pct)} YoY while views-per-day move ${fmtDelta(s.age_bias.velocity_change_pct)} — opposite directions, and neither is a valid cross-year comparison. Year-over-year claims rest on ratios (engagement, comment tone); velocity is only compared within a year and age band.`,
    },
    {
      icon: Gauge,
      title: "Is engagement age-sensitive?",
      body: ageSensitive
        ? `Tested, not assumed — and yes, this year: Spearman ρ between age and engagement is ${fmtNum(rob.rho_age_engagement_curr_mature, 2)} (${fmtNum(rob.rho_age_engagement_prev, 2)} last year). ${olderHigher ? "Older videos engage more, so this year's younger sample is biased down: the YoY change is a conservative estimate." : "Younger videos engage more, so this year's younger sample is biased up: read the YoY change as an upper bound."} Restricting this year to videos ≥120 days old (n = ${fmtNum(rob.n_curr_aged_120d)}) moves it from ${fmtDelta(rob.engagement_change_all_pct)} to ${fmtDelta(rob.engagement_change_curr_aged_120d_pct)}.`
        : `Tested, not assumed: Spearman ρ between age and engagement is ${fmtNum(rob.rho_age_engagement_curr_mature, 2)} this year (${fmtNum(rob.rho_age_engagement_prev, 2)} last year). Restricting this year to videos ≥120 days old moves the YoY change from ${fmtDelta(rob.engagement_change_all_pct)} to ${fmtDelta(rob.engagement_change_curr_aged_120d_pct)}.`,
    },
    {
      icon: Filter,
      title: "A designed sample, not a census",
      body: `search.list returns an algorithm-ranked selection. The sample takes ${s.meta.results_per_query_month ?? "a fixed number of"} videos per month and query (${s.meta.queries.map((q) => `“${q}”`).join(", ")}), so video counts measure the design, not market supply. Findings describe what the platform surfaces for the topic — which is what a viewer or a media buyer actually meets.`,
    },
    {
      icon: Scissors,
      title: "Format definitions",
      body: `Formats follow the brief: Short < 1 min, mid-length 1–10 min, long-form > 10 min. Since October 2024 Shorts can run up to 3 minutes, so some Shorts land in “mid”; the duration chart keeps a separate 1–3 min band (${fmtNum(s.duration_bins[1]?.n_prev)} → ${fmtNum(s.duration_bins[1]?.n_curr)} videos) to make that visible.`,
    },
    {
      icon: ShieldAlert,
      title: "Comment integrity",
      body: `Before scoring sentiment the pipeline removed ${fmtNum(a.comments_dropped_creator_or_link)} comments by creators or containing links, ${fmtNum(a.comments_dropped_duplicate_spam)} cross-video duplicates and ${fmtNum(a.comments_dropped_promotional)} coordinated promotional comments for ${promo.brands.length} products. Candidates come from an automated report (a brand named in comments on many videos that never mention it); the final list is confirmed by a person.`,
    },
    {
      icon: Languages,
      title: "Language and NLP limits",
      body: `${fmtNum(a.dropped_non_english)} non-English videos were excluded; of the remaining comments only English ones are scored (${fmtNum(a.comments_scored_english)}), because VADER is an English lexicon. It handles negation, intensifiers, emoji and “but” contrasts, but not sarcasm. Topics come from a rule-based classifier designed on the sample's own titles.`,
    },
    {
      icon: EyeOff,
      title: "Retention is not observable",
      body: `Audience retention and shares exist only in the owner-authenticated YouTube Analytics API. This study measures engagement ratio, (likes + comments) / views, and never labels it retention. ${fmtNum(a.engagement_missing_hidden_counts)} videos with hidden like counts are excluded, not imputed as zero. With ${s.tests_in_family} tests, every p-value is corrected with Benjamini-Hochberg (q).`,
    },
  ];

  return (
    <div className={VIZ_VARS}>
      {/* ── 1. Header & context ──────────────────────────────── */}
      <section className="pt-16 sm:pt-24 pb-14 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <FadeUp>
            <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071e3] hover:underline no-underline">
              <ArrowLeft className="w-4 h-4" /> All projects
            </Link>
          </FadeUp>
          <FadeUp delay={0.05}>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
              Case Study · Social Media Data Science · Market Intelligence
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="text-[clamp(2.2rem,5.5vw,3.75rem)] font-bold tracking-[-0.04em] leading-[1.05] text-[#1d1d1f] dark:text-white">
              Market &amp; Content Intelligence on YouTube
            </h1>
          </FadeUp>
          <FadeUp delay={0.16}>
            <p className="text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed max-w-[600px] mx-auto">
              How the {s.meta.topic} niche shifted in a year — in format, engagement, comment
              integrity and vocabulary — measured on real YouTube data with age-normalized
              metrics and corrected statistics.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {SCOPE.map(({ label: l, value }) => (
                <div key={l} className="rounded-2xl bg-[#f5f5f7] dark:bg-[#1d1d1f] px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{l}</dt>
                  <dd className="mt-1 text-[13px] font-semibold text-[#1d1d1f] dark:text-white leading-snug">{value}</dd>
                </div>
              ))}
            </dl>
          </FadeUp>
          <FadeUp delay={0.24}>
            <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
              <Link
                href={DASHBOARD}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0071e3] text-white text-sm font-medium transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_0_22px_rgba(0,113,227,0.38)] active:scale-[0.97] no-underline"
              >
                Open Interactive Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#methodology"
                className="px-6 py-2.5 rounded-full border border-[#0071e3]/30 text-[#0071e3] text-sm font-medium transition-all duration-200 hover:border-[#0071e3]/60 hover:bg-[#0071e3]/5 active:scale-[0.97] no-underline"
              >
                Methodology
              </a>
            </div>
          </FadeUp>
          <FadeUp delay={0.28}>
            <DataSourceNotice fetchedAt={s.meta.fetched_at} videos={totalVideos} comments={organicComments} className="justify-center" />
          </FadeUp>
        </div>
      </section>

      {/* ── 2. Executive highlights ──────────────────────────── */}
      <section className="px-6 pb-20" aria-labelledby="highlights">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <SectionHeading eyebrow="Executive Highlights" title="What a VP of Marketing needs to know">
              Three shifts, each with its effect size and its uncertainty attached.
            </SectionHeading>
          </FadeUp>
          <StaggerGrid className="grid md:grid-cols-3 gap-4">
            {s.highlights.map((h) => (
              <StaggerItem key={h.id}>
                <HighlightCard highlight={h} prevLabel={prevP.label} currLabel={currP.label} />
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── 3. Core insights & strategic implications ────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-6 sm:px-12 py-14">
          <FadeUp>
            <SectionHeading eyebrow="Core Insights" title="What changed year over year">
              {changeSentence.charAt(0).toUpperCase() + changeSentence.slice(1)}
            </SectionHeading>
          </FadeUp>

          {/* Format row */}
          <StaggerGrid className="grid sm:grid-cols-3 gap-4">
            {(["short", "mid", "long"] as const).map((k) => {
              const f = fm[k];
              return (
                <StaggerItem key={k}>
                  <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
                    <p className="text-[12px] font-semibold text-[#86868b]">{f.label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-[#1d1d1f] dark:text-white">
                      {fmtPct(f.share_prev, 0)} → {fmtPct(f.share_curr, 0)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#6e6e73] dark:text-[#a1a1a6]">
                      of surfaced videos · {fmtQ(f.share_q_value)}
                    </p>
                    <p className="mt-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Engagement {fmtPct(f.engagement.median_prev, 2)} → {fmtPct(f.engagement.median_curr, 2)}{" "}
                      <span className="font-semibold">({fmtDelta(f.engagement.change_pct)})</span>
                    </p>
                    <p className="mt-2 font-mono text-[10.5px] text-[#86868b]">
                      n = {f.engagement.n_prev} / {f.engagement.n_curr} · {fmtQ(f.engagement.q_value)}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>

          <div className="mt-4 grid lg:grid-cols-5 gap-4">
            {/* Topic share table */}
            <FadeUp className="lg:col-span-3">
              <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Share of surfaced videos by subtopic</h3>
                <p className="mt-1 text-[12px] text-[#86868b]">Two-proportion z-test, Benjamini-Hochberg corrected</p>
                <table className="mt-4 w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-[0.06em] text-[#86868b]">
                      <th className="py-2 font-semibold">Subtopic</th>
                      <th className="py-2 font-semibold text-right">{prevP.label}</th>
                      <th className="py-2 font-semibold text-right">{currP.label}</th>
                      <th className="py-2 font-semibold text-right">Δ pp</th>
                      <th className="py-2 font-semibold text-right hidden sm:table-cell">Test</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {shareShifts.map((c) => {
                      const d = c.share_curr - c.share_prev;
                      return (
                        <tr key={c.key} className="border-t border-black/5 dark:border-white/10">
                          <td className="py-2.5 font-medium text-[#1d1d1f] dark:text-white">{c.label}</td>
                          <td className="py-2.5 text-right text-[#6e6e73] dark:text-[#a1a1a6]">{fmtPct(c.share_prev, 1)}</td>
                          <td className="py-2.5 text-right text-[#1d1d1f] dark:text-white">{fmtPct(c.share_curr, 1)}</td>
                          <td className="py-2.5 text-right font-semibold text-[#1d1d1f] dark:text-white">
                            <span className="inline-flex items-center gap-1">
                              {d >= 0
                                ? <TrendingUp className="w-3.5 h-3.5 text-[#0071e3]" aria-label="up" />
                                : <TrendingDown className="w-3.5 h-3.5 text-[#86868b]" aria-label="down" />}
                              {d >= 0 ? "+" : "−"}{Math.abs(d).toFixed(1)}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-[11px] text-[#86868b] hidden sm:table-cell">{fmtQ(c.share_q_value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] text-[#86868b]">
                  {significantShares.length === 0
                    ? "No subtopic shift survives correction for multiple tests: the topic mix held steady."
                    : `Significant after correction: ${significantShares.map((c) => c.label).join(", ")}.`}
                </p>
              </div>
            </FadeUp>

            {/* Vocabulary */}
            <FadeUp delay={0.08} className="lg:col-span-2">
              <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6 space-y-6">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Vocabulary shift</h3>
                  <p className="mt-1 text-[12px] text-[#86868b]">Log-odds ratio with an informative Dirichlet prior (z-score)</p>
                </div>
                <TermList label="In titles" shifts={s.emerging_terms.titles} tone="titles" />
                <TermList label="In viewer comments" shifts={s.emerging_terms.comments} tone="comments" />
              </div>
            </FadeUp>
          </div>

          {/* Quotes */}
          {quotes.length > 0 && (
            <>
              <FadeUp>
                <h3 className="mt-14 text-center text-[clamp(1.3rem,2.6vw,1.75rem)] font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                  In viewers&apos; words
                </h3>
                <p className="mt-2 text-center text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] max-w-xl mx-auto">
                  The most-liked organic comment with a clear tone, per year. Authors omitted; links,
                  mentions and profanity filtered.
                </p>
              </FadeUp>
              <StaggerGrid className="mt-8 grid sm:grid-cols-2 gap-4">
                {quotes.map(({ q, tone, period }) => (
                  <StaggerItem key={q.text}>
                    <QuoteCard quote={q} tone={tone} period={period} />
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </>
          )}

          {/* Correlations */}
          <FadeUp>
            <div className="mt-14 rounded-3xl bg-white dark:bg-[#2c2c2e] p-6 overflow-x-auto">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">What moves with what</h3>
              <p className="mt-1 text-[12px] text-[#86868b]">
                Spearman ρ per year. Relative velocity = views/day vs videos of the same year and age band.
              </p>
              <table className="mt-4 w-full min-w-[460px] text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.06em] text-[#86868b]">
                    <th className="py-2 font-semibold">Pair</th>
                    <th className="py-2 font-semibold text-right">{prevP.label}</th>
                    <th className="py-2 font-semibold text-right">{currP.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.correlations.map((c) => (
                    <tr key={c.label} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-2.5 font-medium text-[#1d1d1f] dark:text-white">{c.label}</td>
                      {([c.prev, c.curr] as const).map((r, i) => (
                        <td key={i} className="py-2.5 text-right text-[#1d1d1f] dark:text-white">
                          {r.rho === null ? "—" : `${r.rho > 0 ? "+" : "−"}${Math.abs(r.rho).toFixed(2)}`}
                          <span className="ml-1 text-[10.5px] text-[#86868b]">n={r.n}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeUp>

          {/* Recommendations */}
          <FadeUp>
            <h3 className="mt-14 text-center text-[clamp(1.3rem,2.6vw,1.75rem)] font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
              Strategic implications
            </h3>
            <p className="mt-2 text-center text-[14px] text-[#6e6e73] dark:text-[#a1a1a6]">
              Generated from the computed results, so they change if the data does.
            </p>
          </FadeUp>
          <StaggerGrid className="mt-8 grid md:grid-cols-2 gap-4">
            {s.recommendations.map((r) => {
              const Icon = r.audience === "Creators" ? Clapperboard : Megaphone;
              return (
                <StaggerItem key={r.title}>
                  <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[11px] font-semibold text-[#0058b0] dark:text-[#66b2ff]">
                      <Icon className="w-3.5 h-3.5" aria-hidden /> For {r.audience.toLowerCase()}
                    </span>
                    <h4 className="mt-3 text-[15.5px] font-semibold text-[#1d1d1f] dark:text-white leading-snug">{r.title}</h4>
                    <p className="mt-2 text-[13.5px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">{r.body}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* ── 4. Methodology & data architecture ───────────────── */}
      <section id="methodology" className="px-6 pb-20 scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <SectionHeading eyebrow="Methodology Deep Dive" title="Normalizing for time before comparing">
              A video with a year on the platform and one with a month are not competing on the
              same terms. Every metric below exists to make a fair comparison possible — and the
              ones that cannot be made fair are not reported across years.
            </SectionHeading>
          </FadeUp>

          <FadeUp delay={0.06}>
            <div className="rounded-[2rem] bg-[#0a0a0f] dark:bg-[#1d1d1f] border border-white/10 p-6 sm:p-8 font-mono text-[13px] leading-loose text-[#d2d2d7] overflow-x-auto">
              <p><span className="text-[#66b2ff]">daily_velocity</span> = views / days_since_published <span className="text-[#8e8e93]">  # videos &lt; {s.thresholds.maturity_days} days excluded</span></p>
              <p><span className="text-[#30d158]">engagement_ratio</span> = (likes + comment_count) / views × 100 <span className="text-[#8e8e93]">  # views ≥ {s.thresholds.min_views}</span></p>
              <p><span className="text-[#ffd60a]">relative_velocity</span> = velocity / median(velocity | same year, same {s.thresholds.age_band_days}-day age band)</p>
              <p><span className="text-[#bf5af2]">sentiment_index</span> = mean(VADER compound of organic comments) × 100 <span className="text-[#8e8e93]">  # ≥ {s.thresholds.min_comments_for_sentiment} comments</span></p>
              <p className="text-[#8e8e93]">YoY effect = Δ median · bootstrap 95% CI ({fmtNum(s.thresholds.bootstrap_resamples)} resamples) · Mann-Whitney U · Benjamini-Hochberg q</p>
            </div>
          </FadeUp>

          <StaggerGrid className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BIASES.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title}>
                <div className="h-full rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-6">
                  <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-[#0071e3]/10 mb-4">
                    <Icon className="w-[18px] h-[18px] text-[#0071e3]" aria-hidden />
                  </span>
                  <h3 className="text-[15.5px] font-semibold text-[#1d1d1f] dark:text-white">{title}</h3>
                  <p className="mt-2 text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">{body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>

          <FadeUp delay={0.06}>
            <div className="mt-10">
              <PipelineDiagram
                records={totalVideos}
                comments={organicComments}
                quota={a.quota_used ?? 0}
              />
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="px-6 pb-28">
        <FadeUp>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
              Slice it yourself.
            </h2>
            <p className="mt-3 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6]">
              Filter by period, format and subtopic, and watch every chart recompute from the
              video-level data.
            </p>
            <Link
              href={DASHBOARD}
              className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#0071e3] text-white text-[15px] font-medium transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_0_26px_rgba(0,113,227,0.4)] active:scale-[0.97] no-underline"
            >
              Open Interactive Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeUp>
      </section>
    </div>
  );
}
