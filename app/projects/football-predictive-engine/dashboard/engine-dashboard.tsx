"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from "recharts";
import {
  ArrowLeft, CalendarClock, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, Activity, Target, FlaskConical,
  ChevronRight, Sparkles, BookOpenText, BarChart3, BrainCircuit,
} from "lucide-react";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

/* ── Types (filled server-side from the engine's output files) ─────────── */
export interface TrackedMatch {
  id:        string;
  round:     number;
  group:     string;
  teamA:     string;
  teamB:     string;
  probA:     number;
  probDraw:  number;
  probB:     number;
  predicted: string;           // team name or "Draw"
  resolved:  boolean;
  goalsA:    number | null;
  goalsB:    number | null;
  outcome:   string | null;    // team name or "Draw"
  correct:   boolean | null;
}

export interface FormEntry {
  team:     string;
  index:    number;            // 1.0 = neutral baseline
  deltaPct: number;            // (index − 1) × 100
}

/** Post-match intelligence extracted by the generative-AI scraping layer
 *  and stored in ai_match_insights.json. Every field is optional by design:
 *  the UI degrades gracefully when telemetry hasn't been generated yet. */
export interface MatchInsight {
  match_id:  string;
  narrative?: string;
  ai_verdict?: string;
  advanced_stats?: {
    xg_a?: number;         xg_b?: number;
    possession_a?: number; possession_b?: number;
    duels_won_a?: number;  duels_won_b?: number;
  };
}

/* ── Apple palette tokens ───────────────────────────────────────────────── */
const BLUE  = "#0071e3";
const SKY   = "#5ac8fa";
const GREEN = "#30d158";
const RED   = "#ff453a";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/* ── Probability bar (Win A / Draw / Win B) ─────────────────────────────── */
function ProbabilityBar({ a, d, b }: { a: number; d: number; b: number }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px" aria-hidden>
      <span style={{ width: `${a * 100}%`, background: BLUE }} />
      <span
        className="bg-[#aeaeb2] dark:bg-[#636366]"
        style={{ width: `${d * 100}%` }}
      />
      <span style={{ width: `${b * 100}%`, background: SKY }} />
    </div>
  );
}

/* ── Upcoming match card ────────────────────────────────────────────────── */
function UpcomingCard({ m }: { m: TrackedMatch }) {
  const pick = m.predicted === "Draw" ? "Draw" : m.predicted;
  return (
    <div className="rounded-3xl bg-white dark:bg-[#2c2c2e] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[10px] font-bold text-[#0071e3]">
          Group {m.group} · Round {m.round}
        </span>
        <span className="text-[10px] font-medium text-[#86868b] dark:text-[#8e8e93]">
          Pick: <span className="font-bold text-[#1d1d1f] dark:text-white">{pick}</span>
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white truncate">
          {m.teamA}
        </p>
        <p className="text-[11px] text-[#86868b] shrink-0">vs</p>
        <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white truncate text-right">
          {m.teamB}
        </p>
      </div>

      <ProbabilityBar a={m.probA} d={m.probDraw} b={m.probB} />

      <div className="flex items-center justify-between mt-2.5 text-[11px] font-semibold">
        <span style={{ color: BLUE }}>{pct(m.probA)}</span>
        <span className="text-[#86868b] dark:text-[#8e8e93]">
          draw {pct(m.probDraw)}
        </span>
        <span style={{ color: SKY }}>{pct(m.probB)}</span>
      </div>
    </div>
  );
}

/* ── Advanced stat comparison row (modal) ───────────────────────────────── */
function StatDuel({
  label, a, b, unit = "",
}: {
  label: string; a?: number; b?: number; unit?: string;
}) {
  const hasData = a !== undefined && b !== undefined && a !== null && b !== null;
  const shareA = hasData && a + b > 0 ? (a / (a + b)) * 100 : 50;
  return (
    <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white tabular-nums">
          {hasData ? `${a}${unit}` : "—"}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#86868b] dark:text-[#8e8e93]">
          {label}
        </span>
        <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white tabular-nums">
          {hasData ? `${b}${unit}` : "—"}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px" aria-hidden>
        <span style={{ width: `${shareA}%`, background: hasData ? BLUE : "#d2d2d7" }} />
        <span
          className="bg-[#aeaeb2] dark:bg-[#636366]"
          style={{ width: `${100 - shareA}%`, opacity: hasData ? 1 : 0.4 }}
        />
      </div>
    </div>
  );
}

/* ── Insight section shell (modal) ──────────────────────────────────────── */
function InsightSection({
  icon: Icon, title, children,
}: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4 text-[#0071e3]" />
        <h3 className="text-[12px] font-bold uppercase tracking-[0.07em] text-[#6e6e73] dark:text-[#8e8e93]">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

/** Placeholder shown when the generative pipeline hasn't produced content
 *  for a section yet — the modal never breaks on missing data. */
function PendingInsight({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#d2d2d7] dark:border-[#3a3a3c] px-4 py-5 text-center">
      <p className="text-[12px] text-[#86868b] dark:text-[#8e8e93]">
        {what} pending — generated by the AI scraping layer shortly after the
        final whistle.
      </p>
    </div>
  );
}

/* ── Tracked (resolved) match row — clickable, opens the insight modal ──── */
function TrackingRow({ m, insight }: { m: TrackedMatch; insight?: MatchInsight }) {
  const probOfOutcome =
    m.outcome === "Draw" ? m.probDraw : m.outcome === m.teamA ? m.probA : m.probB;
  const wasUpset = probOfOutcome < 0.25;
  const stats = insight?.advanced_stats;

  return (
    <Dialog>
      {/* ── Card / trigger ── */}
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full text-left flex items-center gap-3 sm:gap-4 rounded-2xl bg-white dark:bg-[#2c2c2e] px-4 py-3 transition-all duration-150 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-px active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50"
        >
          {m.correct ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: GREEN }} />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" style={{ color: RED }} />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white truncate">
              {m.teamA}{" "}
              <span className="font-bold text-[#0071e3]">
                {m.goalsA}–{m.goalsB}
              </span>{" "}
              {m.teamB}
            </p>
            <p className="text-[11px] text-[#86868b] dark:text-[#8e8e93] truncate">
              Predicted: {m.predicted === "Draw" ? "Draw" : m.predicted} ·{" "}
              model priced the outcome at {pct(probOfOutcome)}
            </p>
          </div>

          {wasUpset && (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-amber-500/12 text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
              Upset
            </span>
          )}
          {insight && (
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-violet-500" aria-hidden />
          )}
          <ChevronRight className="w-4 h-4 shrink-0 text-[#aeaeb2] dark:text-[#636366]" />
        </button>
      </DialogTrigger>

      {/* ── Insight modal ── */}
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[10px] font-bold text-[#0071e3]">
              Group {m.group} · Round {m.round}
            </span>
            <span className="text-[10px] font-bold text-[#86868b] dark:text-[#8e8e93]">
              {m.id}
            </span>
          </div>
          <DialogTitle className="text-xl">
            {m.teamA}{" "}
            <span className="text-[#0071e3]">{m.goalsA}–{m.goalsB}</span>{" "}
            {m.teamB}
          </DialogTitle>
          <DialogDescription>
            Model pick: {m.predicted === "Draw" ? "Draw" : m.predicted} ·{" "}
            outcome priced at {pct(probOfOutcome)} ·{" "}
            {m.correct ? "called correctly" : "missed"}
          </DialogDescription>
        </DialogHeader>

        {/* GenAI provenance badge */}
        <div className="mt-4 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/12 to-[#0071e3]/12 border border-violet-500/20 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Generative AI Insights
          </span>
        </div>

        <div className="space-y-6">
          {/* 1 — Match Narrative */}
          <InsightSection icon={BookOpenText} title="Match Narrative">
            {insight?.narrative ? (
              <p className="text-[13.5px] leading-relaxed text-[#515154] dark:text-[#a1a1a6]">
                {insight.narrative}
              </p>
            ) : (
              <PendingInsight what="Narrative" />
            )}
          </InsightSection>

          {/* 2 — Advanced Stats */}
          <InsightSection icon={BarChart3} title="Advanced Stats">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-white">
                {m.teamA}
              </span>
              <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-white">
                {m.teamB}
              </span>
            </div>
            <div className="space-y-2">
              <StatDuel label="Expected Goals" a={stats?.xg_a} b={stats?.xg_b} />
              <StatDuel label="Possession" a={stats?.possession_a} b={stats?.possession_b} unit="%" />
              <StatDuel label="Duels Won" a={stats?.duels_won_a} b={stats?.duels_won_b} unit="%" />
            </div>
            {!stats && (
              <p className="mt-2 text-[11px] text-[#86868b] dark:text-[#8e8e93]">
                Telemetry not yet extracted for this fixture.
              </p>
            )}
          </InsightSection>

          {/* 3 — AI Hybrid Verdict */}
          <InsightSection icon={BrainCircuit} title="AI Hybrid Verdict">
            {insight?.ai_verdict ? (
              <div className="rounded-2xl bg-[#0071e3]/6 dark:bg-[#0071e3]/10 border border-[#0071e3]/15 px-4 py-3.5">
                <p className="text-[13.5px] leading-relaxed text-[#1d1d1f] dark:text-white">
                  {insight.ai_verdict}
                </p>
              </div>
            ) : (
              <PendingInsight what="Hybrid verdict" />
            )}
          </InsightSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Form chart tooltip ─────────────────────────────────────────────────── */
function FormTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const e = payload[0]?.payload as FormEntry;
  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#1d1d1f]/95 backdrop-blur-md shadow-lg border border-black/5 dark:border-white/10 px-4 py-3">
      <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white">{e.team}</p>
      <p
        className="text-[12px] font-bold"
        style={{ color: e.deltaPct >= 0 ? GREEN : RED }}
      >
        {e.deltaPct >= 0 ? "+" : ""}
        {e.deltaPct.toFixed(1)}% · index {e.index.toFixed(3)}
      </p>
    </div>
  );
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
function Kpi({
  icon: Icon, label, value, sub, color = BLUE,
}: {
  icon: React.ElementType; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#6e6e73] dark:text-[#8e8e93]">
          {label}
        </p>
      </div>
      <p className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-[#1d1d1f] dark:text-white">
        {value}
      </p>
      <p className="text-[11px] text-[#86868b] dark:text-[#8e8e93] mt-1">{sub}</p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════════════════ */
export function EngineDashboard({
  matches, form, insights = [],
}: {
  matches: TrackedMatch[]; form: FormEntry[]; insights?: MatchInsight[];
}) {
  const [groupFilter, setGroupFilter] = useState<string>("All");

  /* Index the generative-AI insights by match for O(1) lookup per card */
  const insightById = useMemo(
    () => new Map(insights.map((i) => [i.match_id, i])),
    [insights]
  );

  const upcoming = useMemo(() => matches.filter((m) => !m.resolved), [matches]);
  const resolved = useMemo(() => matches.filter((m) => m.resolved), [matches]);

  const accuracy = resolved.length
    ? resolved.filter((m) => m.correct).length / resolved.length
    : 0;

  const groups = useMemo(
    () => ["All", ...Array.from(new Set(upcoming.map((m) => m.group))).sort()],
    [upcoming]
  );
  const visibleUpcoming = useMemo(
    () =>
      groupFilter === "All"
        ? upcoming
        : upcoming.filter((m) => m.group === groupFilter),
    [upcoming, groupFilter]
  );

  const topRiser  = form[0];
  const topFaller = form[form.length - 1];

  return (
    <div className="pb-28">
      {/* ── Header ─────────────────────────────────────────── */}
      <section className="pt-14 sm:pt-20 pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <Link
              href="/projects/football-predictive-engine"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071e3] hover:underline no-underline"
            >
              <ArrowLeft className="w-4 h-4" /> Case study
            </Link>
          </FadeUp>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <FadeUp delay={0.05}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
                  International Football Predictive Engine
                </p>
                <h1 className="mt-2 text-[clamp(1.9rem,4.5vw,3rem)] font-bold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
                  Forecast Dashboard
                </h1>
              </div>
            </FadeUp>
            <FadeUp delay={0.1}>
              {resolved.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071e3]/10 text-[11px] font-semibold text-[#0071e3]">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Pre-tournament — all projections locked, awaiting kickoff
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#30d158]/12 text-[11px] font-semibold text-green-600 dark:text-green-400">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Live tracking — {resolved.length} result{resolved.length > 1 ? "s" : ""} recorded
                </span>
              )}
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <section className="px-6 mb-14">
        <StaggerGrid className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StaggerItem>
            <Kpi icon={Activity} label="Matches Tracked" value={`${matches.length}`}
                 sub={`${resolved.length} resolved · ${upcoming.length} upcoming`} />
          </StaggerItem>
          <StaggerItem>
            <Kpi icon={Target} label="Match Accuracy"
                 value={resolved.length ? pct(accuracy) : "—"}
                 sub={resolved.length
                   ? `${resolved.filter((m) => m.correct).length} of ${resolved.length} outcomes called`
                   : "awaiting first results"}
                 color={GREEN} />
          </StaggerItem>
          <StaggerItem>
            <Kpi icon={TrendingUp} label="Top Favorite" value={topRiser?.team ?? "—"}
                 sub={`form index ${topRiser?.index.toFixed(2)} (+${topRiser?.deltaPct.toFixed(1)}%)`}
                 color={GREEN} />
          </StaggerItem>
          <StaggerItem>
            <Kpi icon={TrendingDown} label="Longest Odds" value={topFaller?.team ?? "—"}
                 sub={`form index ${topFaller?.index.toFixed(2)} (${topFaller?.deltaPct.toFixed(1)}%)`}
                 color={RED} />
          </StaggerItem>
        </StaggerGrid>
      </section>

      {/* ── Upcoming matches ───────────────────────────────── */}
      <section className="px-6 mb-14">
        <div className="max-w-6xl mx-auto rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-5 sm:px-10 py-10">
          <FadeUp>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <CalendarClock className="w-5 h-5 text-[#0071e3]" />
                <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                  Upcoming Matches
                </h2>
              </div>
              {/* Group filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupFilter(g)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors duration-150 ${
                      groupFilter === g
                        ? "bg-[#0071e3] text-white"
                        : "bg-white dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#8e8e93] hover:text-[#0071e3]"
                    }`}
                  >
                    {g === "All" ? "All groups" : `Group ${g}`}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7">
              Official fixture order. Probabilities blend the calibrated model
              with the Live Form Index — re-priced after every result, no
              retraining involved.
            </p>
          </FadeUp>
          <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {visibleUpcoming.map((m) => (
              <StaggerItem key={m.id}>
                <UpcomingCard m={m} />
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── Match tracking ─────────────────────────────────── */}
      <section className="px-6 mb-14">
        <div className="max-w-6xl mx-auto rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-5 sm:px-10 py-10">
          <FadeUp>
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-[#0071e3]" />
              <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                Match Tracking
              </h2>
              <span
                className="ml-auto px-3 py-1 rounded-full text-[11px] font-bold"
                style={{ background: "rgba(48,209,88,0.12)", color: GREEN }}
              >
                {pct(accuracy)} accuracy
              </span>
            </div>
            <p className="text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7">
              Every prediction is logged before kickoff and audited against the
              final score — including the probability the model had assigned to
              what actually happened. Click any match for the AI-generated
              narrative, advanced telemetry, and hybrid verdict.
            </p>
          </FadeUp>
          {resolved.length === 0 ? (
            <FadeUp>
              <div className="rounded-3xl border-2 border-dashed border-[#d2d2d7] dark:border-[#3a3a3c] py-12 text-center">
                <p className="text-sm font-medium text-[#6e6e73] dark:text-[#8e8e93]">
                  No results yet — every prediction is locked in before
                  kickoff and will be audited here as final scores arrive.
                </p>
              </div>
            </FadeUp>
          ) : (
            <StaggerGrid className="grid md:grid-cols-2 gap-2.5">
              {resolved.map((m) => (
                <StaggerItem key={m.id}>
                  <TrackingRow m={m} insight={insightById.get(m.id)} />
                </StaggerItem>
              ))}
            </StaggerGrid>
          )}
        </div>
      </section>

      {/* ── Dynamic form index ─────────────────────────────── */}
      <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-5 sm:px-10 py-10">
          <FadeUp>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-[#0071e3]" />
              <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                Dynamic Form Index
              </h2>
            </div>
            <p className="text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-8 max-w-2xl">
              Multiplicative ELO-style index for all 48 teams, seeded from
              open betting-market momentum (baseline 1.00). Winning against
              the odds earns an outsized boost, scaled by goal margin and the
              match&apos;s real expected-goals balance. Scroll to explore the
              full field.
            </p>
          </FadeUp>

          <FadeUp delay={0.08}>
            {/* Scrollable viewport — the inner chart is tall enough to give
                every one of the 48 teams its own readable row */}
            <div className="max-h-[600px] overflow-y-auto rounded-2xl bg-white/40 dark:bg-black/20 pr-1">
              <div
                className="text-[#6e6e73] dark:text-[#8e8e93]"
                style={{ height: form.length * 30 + 40 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={form}
                    layout="vertical"
                    margin={{ top: 8, right: 28, bottom: 8, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      domain={["auto", "auto"]}
                      tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
                      tick={{ fill: "currentColor", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="team"
                      width={130}
                      interval={0}
                      tick={{ fill: "currentColor", fontSize: 12, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.25} />
                    <Tooltip content={<FormTip />} cursor={{ fill: "rgba(0,113,227,0.05)" }} />
                    <Bar dataKey="deltaPct" radius={[0, 8, 8, 0]} barSize={16}>
                      {form.map((e) => (
                        <Cell key={e.team} fill={e.deltaPct >= 0 ? GREEN : RED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div className="mt-6 flex flex-wrap gap-2">
              {form.slice(0, 5).map((e) => (
                <span
                  key={e.team}
                  className="px-3 py-1 rounded-full bg-white dark:bg-[#2c2c2e] text-[11px] font-semibold text-[#1d1d1f] dark:text-white"
                >
                  {e.team}{" "}
                  <span style={{ color: e.deltaPct >= 0 ? GREEN : RED }}>
                    {e.index.toFixed(2)}
                  </span>
                </span>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}
