import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Clock, Filter, EyeOff, Scissors, MessageSquareWarning,
  Gauge, Megaphone, Clapperboard, TrendingUp, TrendingDown,
} from "lucide-react";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";
import { cn } from "@/lib/utils";
import { loadSummary } from "./load-summary";
import { DataSourceNotice } from "./components/data-source-notice";
import { HighlightCard } from "./components/highlight-card";
import { PipelineDiagram } from "./components/pipeline-diagram";
import { SectionHeading } from "./components/section-heading";
import { fmtDate, fmtDelta, fmtNum, fmtP, fmtPct } from "./components/format";
import { VIZ_VARS } from "./components/viz-theme";

export const metadata: Metadata = {
  title: "YouTube Topic Intelligence — Joshua Sánchez",
  description:
    "Case study: topic dynamics, engagement efficiency and algorithmic shifting on YouTube — year-over-year, with age-normalized metrics, NLP sentiment and non-parametric inference.",
};

const DASHBOARD = "/projects/youtube-topic-intelligence/dashboard";

export default function YouTubeTopicIntelligenceCaseStudy() {
  const s = loadSummary();
  const [prevP, currP] = s.meta.periods;
  const totalVideos = s.kpis.prev.videos + s.kpis.curr.videos;
  const categories = s.categories.filter((c) => c.key !== "other");
  const shareShifts = [...categories].sort(
    (a, b) => (b.share_curr - b.share_prev) - (a.share_curr - a.share_prev),
  );
  const fm = Object.fromEntries(s.formats.map((f) => [f.key, f]));
  const gainer = shareShifts[0];
  const loser = shareShifts[shareShifts.length - 1];
  const polar = [...categories].sort(
    (a, b) => ((b.critical_share_curr ?? 0) - (b.critical_share_prev ?? 0)) - ((a.critical_share_curr ?? 0) - (a.critical_share_prev ?? 0)),
  )[0];

  const SCOPE = [
    { label: "Topic", value: s.meta.topic },
    { label: "Windows", value: `${prevP.label} vs ${currP.label}` },
    { label: "Snapshot", value: fmtDate(s.meta.snapshot) },
    { label: "Videos", value: totalVideos.toLocaleString("en-US") },
  ];

  const BIASES = [
    {
      icon: Clock,
      title: "Age confound",
      body: `With one snapshot, period and video age are almost perfectly confounded: median age is ${fmtNum(s.age_bias.median_age_days[0])} days last year vs ${fmtNum(s.age_bias.median_age_days[1])} now. Raw views move ${fmtDelta(s.age_bias.raw_views_change_pct)} YoY while views-per-day move ${fmtDelta(s.age_bias.velocity_change_pct)}. They point in opposite directions, and neither is a valid cross-year comparison. Year-over-year claims therefore rest on engagement efficiency, a ratio, and velocity is only compared within a period and age band.`,
    },
    {
      icon: Gauge,
      title: "Is EER age-sensitive?",
      body: `Tested, not assumed: within the current window, Spearman ρ between age and EER is ${fmtNum(s.robustness.rho_age_eer_curr_mature, 2)} (${fmtNum(s.robustness.rho_age_eer_prev, 2)} last year). Restricting this year to videos at least 120 days old (n = ${fmtNum(s.robustness.n_curr_aged_120d)}) moves the overall YoY EER change from ${fmtDelta(s.robustness.eer_change_all_curr_pct)} to ${fmtDelta(s.robustness.eer_change_curr_aged_120d_pct)}, so the conclusions hold.`,
    },
    {
      icon: Filter,
      title: "Selection bias",
      body: "search.list returns an algorithm-ranked selection, not a census, so popular videos are over-represented. Sampling is stratified by month and query so the sample is not concentrated at the end of each window. Findings describe what the platform surfaces for the topic, which is also what a viewer or a media buyer actually meets.",
    },
    {
      icon: Scissors,
      title: "Format definition drift",
      body: `Shorts can run up to 3 minutes since October 2024, so the Short-form cut sits at 180 seconds. The 1–3 minute band grew from ${fmtNum(s.duration_bins[1]?.n_prev)} to ${fmtNum(s.duration_bins[1]?.n_curr)} videos, a policy artifact that a 60-second cut would have misread as a mid-length decline.`,
    },
    {
      icon: EyeOff,
      title: "Retention is not observable",
      body: "Audience retention and shares exist only in the owner-authenticated YouTube Analytics API. This study uses the public Data API, so it measures engagement efficiency, (likes + comments) / views, and never labels it as retention. Hidden like counts are excluded, not imputed as zero.",
    },
    {
      icon: MessageSquareWarning,
      title: "NLP limits",
      body: `Sentiment comes from a lexicon scorer with negation, intensifier and "but"-contrast handling, applied to ${fmtNum(s.audit.comments_scored)} comments. Sarcasm and non-English comments are blind spots.${s.classifier_qa ? ` The rule-based topic classifier agrees with the generator's labels on ${fmtPct(s.classifier_qa.accuracy, 1)} of videos (${fmtPct(s.classifier_qa.other_rate, 1)} routed to "Other").` : ""}`,
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
              Topic dynamics, engagement efficiency and algorithmic shifting in the{" "}
              {s.meta.topic} niche, compared year over year on matched windows with
              age-normalized metrics.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {SCOPE.map(({ label, value }) => (
                <div key={label} className="rounded-2xl bg-[#f5f5f7] dark:bg-[#1d1d1f] px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{label}</dt>
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
            <DataSourceNotice isSynthetic={s.meta.is_synthetic} className="max-w-2xl mx-auto mt-4" />
          </FadeUp>
        </div>
      </section>

      {/* ── 2. Executive highlights ──────────────────────────── */}
      <section className="px-6 pb-20" aria-labelledby="highlights">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <SectionHeading eyebrow="Executive Highlights" title="What a VP of Marketing needs to know">
              Three shifts, each with its effect size and uncertainty attached.
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
              Supply moved toward {gainer.label} and away from {loser.label}; the conversation got
              most critical in {polar.label}; and title vocabulary shifted with it.
            </SectionHeading>
          </FadeUp>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* Topic share shift table */}
            <FadeUp className="lg:col-span-3">
              <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Share of uploads by subtopic</h3>
                <p className="mt-1 text-[12px] text-[#86868b]">Two-proportion z-test on each shift</p>
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
                          <td className="py-2.5 text-right text-[11px] text-[#86868b] hidden sm:table-cell">{fmtP(c.share_p_value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FadeUp>

            {/* Emerging vocabulary */}
            <FadeUp delay={0.08} className="lg:col-span-2">
              <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">Title vocabulary shift</h3>
                <p className="mt-1 text-[12px] text-[#86868b]">Log-odds ratio with an informative Dirichlet prior (z-score)</p>
                {([["Rising", s.emerging_terms.rising], ["Fading", s.emerging_terms.declining]] as const).map(([label, terms]) => (
                  <div key={label} className="mt-5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">{label}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {terms.slice(0, 6).map((t) => (
                        <li
                          key={t.term}
                          title={`${t.prev_per_1k} → ${t.curr_per_1k} per 1k titles`}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[12px] font-medium",
                            label === "Rising"
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
            </FadeUp>
          </div>

          {/* Format + polarization summary row */}
          <StaggerGrid className="mt-4 grid sm:grid-cols-3 gap-4">
            {(["short", "mid", "long"] as const).map((k) => {
              const f = fm[k];
              return (
                <StaggerItem key={k}>
                  <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6">
                    <p className="text-[12px] font-semibold text-[#86868b]">{f.label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-[#1d1d1f] dark:text-white">
                      {fmtDelta(f.eer.change_pct)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#6e6e73] dark:text-[#a1a1a6]">
                      median EER {fmtPct(f.eer.median_prev, 2)} → {fmtPct(f.eer.median_curr, 2)}
                    </p>
                    <p className="mt-3 font-mono text-[10.5px] text-[#86868b]">
                      95% CI [{fmtDelta(f.eer.ci95[0])}, {fmtDelta(f.eer.ci95[1])}] · {fmtP(f.eer.p_value)} · Cliff&apos;s δ {fmtNum(f.eer.cliffs_delta, 2)}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>

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
              A video with 365 days on the platform and one with 30 days are not competing on the
              same terms. Every metric below exists to make a fair comparison possible — and the
              ones that cannot be made fair are not reported across years.
            </SectionHeading>
          </FadeUp>

          <FadeUp delay={0.06}>
            <div className="rounded-[2rem] bg-[#0a0a0f] dark:bg-[#1d1d1f] border border-white/10 p-6 sm:p-8 font-mono text-[13px] leading-loose text-[#d2d2d7] overflow-x-auto">
              <p><span className="text-[#66b2ff]">Daily Velocity</span> = views / days_since_upload <span className="text-[#8e8e93]">  # videos &lt; {s.thresholds.maturity_days} days excluded</span></p>
              <p><span className="text-[#30d158]">Engagement Efficiency Ratio</span> = (likes + comments) / views × 100 <span className="text-[#8e8e93]">  # views ≥ {s.thresholds.min_views}</span></p>
              <p><span className="text-[#ffd60a]">Relative Velocity Index</span> = velocity / median(velocity | same period, same {s.thresholds.age_band_days}-day age band)</p>
              <p><span className="text-[#bf5af2]">Sentiment Index</span> = mean(compound(comment)) × 100 <span className="text-[#8e8e93]">  # −100 … +100</span></p>
              <p className="text-[#8e8e93]">YoY effect = Δ median · bootstrap 95% CI ({s.thresholds.bootstrap_resamples.toLocaleString("en-US")} resamples) · Mann-Whitney U · Cliff&apos;s δ</p>
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
              <PipelineDiagram records={s.audit.analyzed_records ?? totalVideos} comments={s.audit.comments_scored ?? 0} />
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
