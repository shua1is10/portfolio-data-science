"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ScatterChart, Scatter, CartesianGrid,
} from "recharts";
import {
  ArrowLeft, CalendarClock, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, Activity, Target, FlaskConical,
  ChevronRight, Sparkles, BookOpenText, BarChart3, BrainCircuit,
  LayoutGrid, Table2, CalendarRange, ArrowUpRight, ArrowDownRight,
  Goal, Percent, Flame, Award,
} from "lucide-react";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GenAIBadge } from "@/components/ui/genai-badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";

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
    xg_a?: number;          xg_b?: number;
    possession_a?: number;  possession_b?: number;
    total_shots_a?: number; total_shots_b?: number;
    big_chances_a?: number; big_chances_b?: number;
    duels_won_a?: number;   duels_won_b?: number;
  };
}

/** A single ranked row in the Tournament Leaderboard. */
export interface LeaderboardEntry {
  name:  string;
  team:  string;
  stats: number;
}

/** Tournament-wide player leaderboard, extracted by the AI scraping layer
 *  and stored in player_spotlight.json. Surfaced in the Tournament Summary
 *  tab as a three-column ranking (Goals / Assists / Total Shots). */
export interface TournamentLeaderboard {
  topScorers:  LeaderboardEntry[];
  topAssists:  LeaderboardEntry[];
  topShooters: LeaderboardEntry[];
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
    <div className="rounded-3xl bg-white dark:bg-[#2c2c2e] p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[10px] font-bold text-[#0071e3] whitespace-nowrap">
          Group {m.group} · Round {m.round}
        </span>
        <span className="text-[10px] font-medium text-[#86868b] dark:text-[#8e8e93] text-right truncate">
          Pick: <span className="font-bold text-[#1d1d1f] dark:text-white">{pick}</span>
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 sm:gap-3 mb-3">
        <p className="text-[13px] sm:text-[15px] font-semibold text-[#1d1d1f] dark:text-white truncate">
          {m.teamA}
        </p>
        <p className="text-[11px] text-[#86868b] shrink-0">vs</p>
        <p className="text-[13px] sm:text-[15px] font-semibold text-[#1d1d1f] dark:text-white truncate text-right">
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

/* ── Advanced stat comparison row (modal / insight cards) ───────────────── */
function StatDuel({
  label, a, b, unit = "",
}: {
  label: string; a?: number; b?: number; unit?: string;
}) {
  const hasData = a !== undefined && b !== undefined && a !== null && b !== null;
  const shareA = hasData && a + b > 0 ? (a / (a + b)) * 100 : 50;
  return (
    <div className="rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white tabular-nums">
          {hasData ? `${a}${unit}` : "—"}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#86868b] dark:text-[#8e8e93] text-center">
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

/* ── Insight section shell ──────────────────────────────────────────────── */
function InsightSection({
  icon: Icon, title, children,
}: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4 text-[#0071e3]" />
        <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.07em] text-[#6e6e73] dark:text-[#8e8e93]">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

/** Placeholder shown when the generative pipeline hasn't produced content
 *  for a section yet — the UI never breaks on missing data. */
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
          className="w-full text-left flex items-center gap-2.5 sm:gap-4 rounded-2xl bg-white dark:bg-[#2c2c2e] px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-150 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-px active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50"
        >
          {m.correct ? (
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: GREEN }} />
          ) : (
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: RED }} />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-[13px] font-semibold text-[#1d1d1f] dark:text-white truncate">
              {m.teamA}{" "}
              <span className="font-bold text-[#0071e3]">
                {m.goalsA}–{m.goalsB}
              </span>{" "}
              {m.teamB}
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#86868b] dark:text-[#8e8e93] truncate">
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
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[10px] font-bold text-[#0071e3]">
              Group {m.group} · Round {m.round}
            </span>
            <span className="text-[10px] font-bold text-[#86868b] dark:text-[#8e8e93]">
              {m.id}
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl">
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

        {/* AI provenance badge */}
        <div className="mt-4 mb-6">
          <GenAIBadge size="sm" />
        </div>

        <div className="space-y-6">
          {/* 1 — Match Narrative */}
          <InsightSection icon={BookOpenText} title="Match Narrative">
            {insight?.narrative ? (
              <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-[#515154] dark:text-[#a1a1a6]">
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
              <StatDuel label="Total Shots" a={stats?.total_shots_a} b={stats?.total_shots_b} />
              <StatDuel label="Big Chances" a={stats?.big_chances_a} b={stats?.big_chances_b} />
              <StatDuel label="Duels Won" a={stats?.duels_won_a} b={stats?.duels_won_b} />
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
              <div className="rounded-2xl bg-[#0071e3]/6 dark:bg-[#0071e3]/10 border border-[#0071e3]/15 px-3.5 sm:px-4 py-3.5">
                <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-[#1d1d1f] dark:text-white whitespace-pre-line">
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

/* ── Tournament Leaderboard column (Tournament Summary) ─────────────────── */
function LeaderboardColumn({
  icon: Icon, title, unit, color, entries,
}: {
  icon: React.ElementType; title: string; unit: string; color: string;
  entries: LeaderboardEntry[];
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#2c2c2e] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Icon className="w-4 h-4" style={{ color }} />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#1d1d1f] dark:text-white">
          {title}
        </h3>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] text-[#86868b] dark:text-[#8e8e93]">
          No data yet.
        </p>
      ) : (
        <div className="space-y-2.5">
          {entries.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[10px] font-bold text-[#86868b] dark:text-[#8e8e93] flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-[#86868b] dark:text-[#8e8e93] truncate">
                    {p.team}
                  </p>
                </div>
              </div>
              <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color }}>
                {p.stats}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3.5 pt-3 border-t border-[#f5f5f7] dark:border-[#3a3a3c] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#86868b] dark:text-[#8e8e93]">
        {unit}
      </p>
    </div>
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

/* ── xG vs Goals scatter tooltip ────────────────────────────────────────── */
function TelemetryScatterTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as { team: string; matchId: string; xg: number; goals: number };
  const diff = p.goals - p.xg;
  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#1d1d1f]/95 backdrop-blur-md shadow-lg border border-black/5 dark:border-white/10 px-4 py-3">
      <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white">{p.team}</p>
      <p className="text-[11px] text-[#86868b] dark:text-[#8e8e93]">{p.matchId}</p>
      <p className="text-[12px] font-bold mt-1 text-[#1d1d1f] dark:text-white">
        {p.goals} goal{p.goals === 1 ? "" : "s"} vs {p.xg.toFixed(2)} xG
      </p>
      <p className="text-[11px] font-semibold" style={{ color: diff >= 0 ? GREEN : RED }}>
        {diff >= 0 ? "+" : ""}{diff.toFixed(2)} vs expected
      </p>
    </div>
  );
}

/* ── Shot conversion bar tooltip ────────────────────────────────────────── */
function ConversionTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const e = payload[0]?.payload as { team: string; matchId: string; conversion: number; goals: number; shots: number };
  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#1d1d1f]/95 backdrop-blur-md shadow-lg border border-black/5 dark:border-white/10 px-4 py-3">
      <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white">{e.team}</p>
      <p className="text-[11px] text-[#86868b] dark:text-[#8e8e93]">{e.matchId}</p>
      <p className="text-[12px] font-bold mt-1" style={{ color: BLUE }}>
        {e.conversion.toFixed(1)}% conversion · {e.goals}/{e.shots} shots
      </p>
    </div>
  );
}

/* ── KPI / metric card ──────────────────────────────────────────────────── */
function Kpi({
  icon: Icon, label, value, sub, color = BLUE,
}: {
  icon: React.ElementType; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.07em] text-[#6e6e73] dark:text-[#8e8e93]">
          {label}
        </p>
      </div>
      <p className="text-xl sm:text-[1.75rem] font-bold tracking-tight text-[#1d1d1f] dark:text-white truncate">
        {value}
      </p>
      <p className="text-[10px] sm:text-[11px] text-[#86868b] dark:text-[#8e8e93] mt-1">{sub}</p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   GROUP STANDINGS — derived client-side from tracked matches
═══════════════════════════════════════════════════════════════════════════ */
export interface StandingRow {
  team:     string;
  played:   number;
  won:      number;
  drawn:    number;
  lost:     number;
  gf:       number;
  ga:       number;
  gd:       number;
  pts:      number;
  projPts:  number;
  realPos:  number;
  projPos:  number;
  posDelta: number;       // realPos − projPos (negative = outperforming model)
}

/** Computes, per group, the real table (Pts / GD from resolved matches) and
 *  the model's projected table (sum of expected points across all 6 group
 *  fixtures, win=3·prob + draw·probDraw). Both share the same tiebreak-free
 *  ranking so the "Model Projected Position" column is directly comparable
 *  to the live "#" position. */
function computeGroupStandings(matches: TrackedMatch[]): Map<string, StandingRow[]> {
  const byGroup = new Map<string, TrackedMatch[]>();
  matches.forEach((m) => {
    if (!byGroup.has(m.group)) byGroup.set(m.group, []);
    byGroup.get(m.group)!.push(m);
  });

  const result = new Map<string, StandingRow[]>();

  byGroup.forEach((groupMatches, group) => {
    const teams = new Map<string, StandingRow>();
    const ensure = (team: string): StandingRow => {
      if (!teams.has(team)) {
        teams.set(team, {
          team, played: 0, won: 0, drawn: 0, lost: 0,
          gf: 0, ga: 0, gd: 0, pts: 0, projPts: 0,
          realPos: 0, projPos: 0, posDelta: 0,
        });
      }
      return teams.get(team)!;
    };

    groupMatches.forEach((m) => {
      const a = ensure(m.teamA);
      const b = ensure(m.teamB);

      // Model-projected points accrue across every group fixture, resolved or not
      a.projPts += m.probA * 3 + m.probDraw;
      b.projPts += m.probB * 3 + m.probDraw;

      if (m.resolved && m.goalsA !== null && m.goalsB !== null) {
        a.played += 1; b.played += 1;
        a.gf += m.goalsA; a.ga += m.goalsB;
        b.gf += m.goalsB; b.ga += m.goalsA;

        if (m.goalsA > m.goalsB) {
          a.won += 1; a.pts += 3; b.lost += 1;
        } else if (m.goalsA < m.goalsB) {
          b.won += 1; b.pts += 3; a.lost += 1;
        } else {
          a.drawn += 1; b.drawn += 1; a.pts += 1; b.pts += 1;
        }
      }
    });

    const rows = Array.from(teams.values());
    rows.forEach((r) => { r.gd = r.gf - r.ga; });

    const realOrder = [...rows].sort(
      (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team)
    );
    realOrder.forEach((r, i) => { r.realPos = i + 1; });

    const projOrder = [...rows].sort(
      (x, y) => y.projPts - x.projPts || x.team.localeCompare(y.team)
    );
    projOrder.forEach((r, i) => { r.projPos = i + 1; });

    rows.forEach((r) => { r.posDelta = r.realPos - r.projPos; });
    rows.sort((x, y) => x.realPos - y.realPos);

    result.set(group, rows);
  });

  return result;
}

/* ═════════════════════════════════════════════════════════════════════════
   TOURNAMENT SUMMARY — derived from tracked matches + AI insights
═══════════════════════════════════════════════════════════════════════════ */
export interface TournamentSummary {
  matchesPlayed:   number;
  totalGoals:      number;
  goalsPerMatch:   number;
  topScoringMatch?: { id: string; teamA: string; teamB: string; total: number };
  bestDefense?:     { team: string; conceded: number; played: number };
  possessionLeader?: { team: string; possession: number; matchId: string };
  bigChancesLeader?: { team: string; count: number; matchId: string };
}

function computeSummary(matches: TrackedMatch[], insights: MatchInsight[]): TournamentSummary {
  const resolved = matches.filter((m) => m.resolved && m.goalsA !== null && m.goalsB !== null);

  const totalGoals = resolved.reduce(
    (sum, m) => sum + (m.goalsA ?? 0) + (m.goalsB ?? 0), 0
  );
  const goalsPerMatch = resolved.length ? totalGoals / resolved.length : 0;

  let topScoringMatch: TournamentSummary["topScoringMatch"];
  resolved.forEach((m) => {
    const total = (m.goalsA ?? 0) + (m.goalsB ?? 0);
    if (!topScoringMatch || total > topScoringMatch.total) {
      topScoringMatch = { id: m.id, teamA: m.teamA, teamB: m.teamB, total };
    }
  });

  const conceded = new Map<string, { conceded: number; played: number }>();
  resolved.forEach((m) => {
    const a = conceded.get(m.teamA) ?? { conceded: 0, played: 0 };
    const b = conceded.get(m.teamB) ?? { conceded: 0, played: 0 };
    a.conceded += m.goalsB ?? 0; a.played += 1;
    b.conceded += m.goalsA ?? 0; b.played += 1;
    conceded.set(m.teamA, a); conceded.set(m.teamB, b);
  });
  let bestDefense: TournamentSummary["bestDefense"];
  conceded.forEach((v, team) => {
    if (!bestDefense || v.conceded < bestDefense.conceded) {
      bestDefense = { team, conceded: v.conceded, played: v.played };
    }
  });

  let possessionLeader: TournamentSummary["possessionLeader"];
  let bigChancesLeader: TournamentSummary["bigChancesLeader"];
  insights.forEach((ins) => {
    const m = matches.find((mm) => mm.id === ins.match_id);
    const stats = ins.advanced_stats;
    if (!m || !stats) return;

    if (stats.possession_a !== undefined &&
        (!possessionLeader || stats.possession_a > possessionLeader.possession)) {
      possessionLeader = { team: m.teamA, possession: stats.possession_a, matchId: m.id };
    }
    if (stats.possession_b !== undefined &&
        (!possessionLeader || stats.possession_b > possessionLeader.possession)) {
      possessionLeader = { team: m.teamB, possession: stats.possession_b, matchId: m.id };
    }
    if (stats.big_chances_a !== undefined &&
        (!bigChancesLeader || stats.big_chances_a > bigChancesLeader.count)) {
      bigChancesLeader = { team: m.teamA, count: stats.big_chances_a, matchId: m.id };
    }
    if (stats.big_chances_b !== undefined &&
        (!bigChancesLeader || stats.big_chances_b > bigChancesLeader.count)) {
      bigChancesLeader = { team: m.teamB, count: stats.big_chances_b, matchId: m.id };
    }
  });

  return { matchesPlayed: resolved.length, totalGoals, goalsPerMatch, topScoringMatch, bestDefense, possessionLeader, bigChancesLeader };
}

/* ── Group standings table (mobile: horizontally scrollable) ───────────── */
function GroupStandingsTable({ group, rows }: { group: string; rows: StandingRow[] }) {
  return (
    <div className="rounded-3xl bg-white dark:bg-[#2c2c2e] p-4 sm:p-5">
      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[10px] font-bold text-[#0071e3] mb-3">
        Group {group}
      </span>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[11px] sm:text-[12px] min-w-[420px]">
          <thead>
            <tr className="text-left text-[#86868b] dark:text-[#8e8e93]">
              <th className="py-1.5 px-1 font-semibold">Team</th>
              <th className="py-1.5 px-1 font-semibold text-center">P</th>
              <th className="py-1.5 px-1 font-semibold text-center">W</th>
              <th className="py-1.5 px-1 font-semibold text-center">D</th>
              <th className="py-1.5 px-1 font-semibold text-center">L</th>
              <th className="py-1.5 px-1 font-semibold text-center">GD</th>
              <th className="py-1.5 px-1 font-semibold text-center">Pts</th>
              <th className="py-1.5 px-1 font-semibold text-center whitespace-nowrap">Model Proj.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team} className="border-t border-[#f5f5f7] dark:border-[#3a3a3c]">
                <td className="py-1.5 px-1 font-semibold text-[#1d1d1f] dark:text-white truncate max-w-[140px]">
                  {r.realPos}. {r.team}
                </td>
                <td className="py-1.5 px-1 text-center tabular-nums text-[#515154] dark:text-[#a1a1a6]">{r.played}</td>
                <td className="py-1.5 px-1 text-center tabular-nums text-[#515154] dark:text-[#a1a1a6]">{r.won}</td>
                <td className="py-1.5 px-1 text-center tabular-nums text-[#515154] dark:text-[#a1a1a6]">{r.drawn}</td>
                <td className="py-1.5 px-1 text-center tabular-nums text-[#515154] dark:text-[#a1a1a6]">{r.lost}</td>
                <td className="py-1.5 px-1 text-center tabular-nums text-[#515154] dark:text-[#a1a1a6]">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="py-1.5 px-1 text-center font-bold tabular-nums text-[#1d1d1f] dark:text-white">{r.pts}</td>
                <td className="py-1.5 px-1 text-center">
                  <span className="inline-flex items-center gap-1 tabular-nums text-[#515154] dark:text-[#a1a1a6]">
                    #{r.projPos}
                    {r.posDelta !== 0 && (
                      r.posDelta < 0 ? (
                        <ArrowUpRight className="w-3 h-3" style={{ color: GREEN }} />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" style={{ color: RED }} />
                      )
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab definitions ─────────────────────────────────────────────────────── */
const TAB_ITEMS: TabItem[] = [
  { value: "summary",   label: "Tournament Summary",        icon: LayoutGrid },
  { value: "standings", label: "Group Standings & Tracking", icon: Table2 },
  { value: "fixtures",  label: "Upcoming Fixtures",          icon: CalendarRange },
  { value: "form",      label: "Dynamic Form Index",         icon: TrendingUp },
  { value: "telemetry", label: "AI Telemetry Insights",      icon: BrainCircuit },
];

/* ═════════════════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════════════════ */
const EMPTY_LEADERBOARD: TournamentLeaderboard = {
  topScorers: [], topAssists: [], topShooters: [],
};

export function EngineDashboard({
  matches, form, insights = [], playerSpotlight = EMPTY_LEADERBOARD,
}: {
  matches: TrackedMatch[]; form: FormEntry[]; insights?: MatchInsight[];
  playerSpotlight?: TournamentLeaderboard;
}) {
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [groupFilter, setGroupFilter] = useState<string>("All");
  const [roundFilter, setRoundFilter] = useState<string>("All");

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

  /* Derived from ALL matches (not just upcoming) so the "All groups" filter
   * always returns to the complete fixture list — fixes the empty-view bug. */
  const groups = useMemo(
    () => ["All", ...Array.from(new Set(matches.map((m) => m.group))).sort()],
    [matches]
  );
  const rounds = useMemo(
    () => ["All", ...Array.from(new Set(matches.map((m) => String(m.round)))).sort()],
    [matches]
  );

  const visibleUpcoming = useMemo(
    () => upcoming.filter((m) =>
      (groupFilter === "All" || m.group === groupFilter) &&
      (roundFilter === "All" || String(m.round) === roundFilter)
    ),
    [upcoming, groupFilter, roundFilter]
  );

  const standings = useMemo(() => computeGroupStandings(matches), [matches]);
  const summary = useMemo(() => computeSummary(matches, insights), [matches, insights]);

  /* xG vs actual goals — one point per team per resolved fixture with
   * telemetry, used by the AI Telemetry macro dashboard. */
  const telemetryPoints = useMemo(() => {
    const points: { team: string; matchId: string; xg: number; goals: number }[] = [];
    insights.forEach((ins) => {
      const m = matches.find((mm) => mm.id === ins.match_id);
      const stats = ins.advanced_stats;
      if (!m || !m.resolved || !stats) return;
      if (stats.xg_a !== undefined && m.goalsA !== null) {
        points.push({ team: m.teamA, matchId: m.id, xg: stats.xg_a, goals: m.goalsA });
      }
      if (stats.xg_b !== undefined && m.goalsB !== null) {
        points.push({ team: m.teamB, matchId: m.id, xg: stats.xg_b, goals: m.goalsB });
      }
    });
    return points;
  }, [insights, matches]);

  const telemetryMax = useMemo(
    () => Math.max(1, ...telemetryPoints.flatMap((p) => [p.xg, p.goals])) + 0.5,
    [telemetryPoints]
  );

  /* Shot conversion (goals / total shots) per team, used for the second
   * macro chart in the AI Telemetry dashboard. */
  const conversionData = useMemo(() => {
    const rows: { team: string; matchId: string; conversion: number; goals: number; shots: number }[] = [];
    insights.forEach((ins) => {
      const m = matches.find((mm) => mm.id === ins.match_id);
      const stats = ins.advanced_stats;
      if (!m || !m.resolved || !stats) return;
      if (stats.total_shots_a && m.goalsA !== null) {
        rows.push({ team: m.teamA, matchId: m.id, goals: m.goalsA, shots: stats.total_shots_a, conversion: (m.goalsA / stats.total_shots_a) * 100 });
      }
      if (stats.total_shots_b && m.goalsB !== null) {
        rows.push({ team: m.teamB, matchId: m.id, goals: m.goalsB, shots: stats.total_shots_b, conversion: (m.goalsB / stats.total_shots_b) * 100 });
      }
    });
    return rows.sort((a, b) => b.conversion - a.conversion);
  }, [insights, matches]);

  const topRiser  = form[0];
  const topFaller = form[form.length - 1];

  return (
    <div className="pb-28">
      {/* ── Header ─────────────────────────────────────────── */}
      <section className="pt-14 sm:pt-20 pb-10 px-4 sm:px-6">
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
                <h1 className="mt-2 text-[clamp(1.7rem,4.5vw,3rem)] font-bold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
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

      {/* ── KPI strip (fixed, always visible) ───────────────── */}
      <section className="px-4 sm:px-6 mb-8 sm:mb-10">
        <StaggerGrid className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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

      {/* ── Tab navigation ───────────────────────────────────── */}
      <section className="px-4 sm:px-6 mb-8 sm:mb-10">
        <div className="max-w-6xl mx-auto">
          <Tabs items={TAB_ITEMS} value={activeTab} onValueChange={setActiveTab} />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          TAB 1 — Tournament Summary
      ════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <section className="px-4 sm:px-6 mb-14">
          <div className="max-w-6xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-4 sm:px-10 py-8 sm:py-10">
            <FadeUp>
              <div className="flex items-center gap-3 mb-2">
                <LayoutGrid className="w-5 h-5 text-[#0071e3]" />
                <h2 className="text-lg sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                  Tournament Summary
                </h2>
              </div>
              <p className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7 max-w-2xl">
                Global metrics aggregated across every resolved fixture, plus
                standout performances surfaced by the AI telemetry layer.
              </p>
            </FadeUp>

            <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4">
              <StaggerItem>
                <Kpi icon={Goal} label="Total Goals" value={`${summary.totalGoals}`}
                     sub={`${summary.matchesPlayed} match${summary.matchesPlayed === 1 ? "" : "es"} played`} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={Activity} label="Goals / Match"
                     value={summary.matchesPlayed ? summary.goalsPerMatch.toFixed(2) : "—"}
                     sub="average across resolved fixtures" color={SKY} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={Flame} label="Top-Scoring Match"
                     value={summary.topScoringMatch ? `${summary.topScoringMatch.total} goals` : "—"}
                     sub={summary.topScoringMatch
                       ? `${summary.topScoringMatch.teamA} vs ${summary.topScoringMatch.teamB}`
                       : "no results yet"}
                     color={RED} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={Activity} label="Best Defense"
                     value={summary.bestDefense?.team ?? "—"}
                     sub={summary.bestDefense
                       ? `${summary.bestDefense.conceded} conceded in ${summary.bestDefense.played}`
                       : "no results yet"}
                     color={GREEN} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={Percent} label="Possession Leader"
                     value={summary.possessionLeader?.team ?? "—"}
                     sub={summary.possessionLeader
                       ? `${summary.possessionLeader.possession}% in ${summary.possessionLeader.matchId}`
                       : "awaiting AI telemetry"}
                     color={BLUE} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={Target} label="Big Chances Leader"
                     value={summary.bigChancesLeader?.team ?? "—"}
                     sub={summary.bigChancesLeader
                       ? `${summary.bigChancesLeader.count} created in ${summary.bigChancesLeader.matchId}`
                       : "awaiting AI telemetry"}
                     color={SKY} />
              </StaggerItem>
            </StaggerGrid>

            <FadeUp delay={0.1}>
              <InsightSection icon={Award} title="Tournament Leaderboard">
                {playerSpotlight.topScorers.length === 0 &&
                 playerSpotlight.topAssists.length === 0 &&
                 playerSpotlight.topShooters.length === 0 ? (
                  <PendingInsight what="Tournament leaderboard telemetry" />
                ) : (
                  <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
                    <LeaderboardColumn
                      icon={Goal} title="Top Scorers" unit="Goals" color={GREEN}
                      entries={playerSpotlight.topScorers}
                    />
                    <LeaderboardColumn
                      icon={Sparkles} title="Top Playmakers" unit="Assists" color={BLUE}
                      entries={playerSpotlight.topAssists}
                    />
                    <LeaderboardColumn
                      icon={Target} title="Most Active Shooters" unit="Total Shots" color={SKY}
                      entries={playerSpotlight.topShooters}
                    />
                  </div>
                )}
              </InsightSection>
            </FadeUp>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════
          TAB 2 — Group Standings & Tracking
      ════════════════════════════════════════════════════ */}
      {activeTab === "standings" && (
        <>
          <section className="px-4 sm:px-6 mb-10">
            <div className="max-w-6xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-4 sm:px-10 py-8 sm:py-10">
              <FadeUp>
                <div className="flex items-center gap-3 mb-2">
                  <Table2 className="w-5 h-5 text-[#0071e3]" />
                  <h2 className="text-lg sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                    Group Standings
                  </h2>
                </div>
                <p className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7 max-w-2xl">
                  Live table per group (Pts, GD, tiebreakers) next to the
                  model&apos;s projected position — derived from expected
                  points across all three matchdays. Scroll horizontally on
                  small screens.
                </p>
              </FadeUp>
              <StaggerGrid className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                {Array.from(standings.entries()).map(([group, rows]) => (
                  <StaggerItem key={group}>
                    <GroupStandingsTable group={group} rows={rows} />
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </div>
          </section>

          <section className="px-4 sm:px-6 mb-14">
            <div className="max-w-6xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-4 sm:px-10 py-8 sm:py-10">
              <FadeUp>
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-[#0071e3]" />
                  <h2 className="text-lg sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                    Match Tracking
                  </h2>
                  <span
                    className="ml-auto px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap"
                    style={{ background: "rgba(48,209,88,0.12)", color: GREEN }}
                  >
                    {pct(accuracy)} accuracy
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7">
                  Every prediction is logged before kickoff and audited against
                  the final score — including the probability the model had
                  assigned to what actually happened. Tap any match for the
                  AI-generated narrative, advanced telemetry, and hybrid
                  verdict.
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
                <StaggerGrid className="grid md:grid-cols-2 gap-2 sm:gap-2.5">
                  {resolved.map((m) => (
                    <StaggerItem key={m.id}>
                      <TrackingRow m={m} insight={insightById.get(m.id)} />
                    </StaggerItem>
                  ))}
                </StaggerGrid>
              )}
            </div>
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          TAB 3 — Upcoming Fixtures
      ════════════════════════════════════════════════════ */}
      {activeTab === "fixtures" && (
        <section className="px-4 sm:px-6 mb-14">
          <div className="max-w-6xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-4 sm:px-10 py-8 sm:py-10">
            <FadeUp>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <CalendarClock className="w-5 h-5 text-[#0071e3]" />
                  <h2 className="text-lg sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                    Upcoming Fixtures
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Round / matchday filter */}
                  <div className="flex flex-wrap gap-1.5">
                    {rounds.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRoundFilter(r)}
                        className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-colors duration-150 ${
                          roundFilter === r
                            ? "bg-[#0071e3] text-white"
                            : "bg-white dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#8e8e93] hover:text-[#0071e3]"
                        }`}
                      >
                        {r === "All" ? "All rounds" : `Matchday ${r}`}
                      </button>
                    ))}
                  </div>
                  {/* Group filter */}
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGroupFilter(g)}
                        className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-colors duration-150 ${
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
              </div>
              <p className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7">
                Official fixture order across all three matchdays.
                Probabilities blend the calibrated model with the Live Form
                Index — re-priced after every result, no retraining involved.
              </p>
            </FadeUp>
            {visibleUpcoming.length === 0 ? (
              <FadeUp>
                <div className="rounded-3xl border-2 border-dashed border-[#d2d2d7] dark:border-[#3a3a3c] py-12 text-center">
                  <p className="text-sm font-medium text-[#6e6e73] dark:text-[#8e8e93]">
                    No upcoming fixtures match the selected filters.
                  </p>
                </div>
              </FadeUp>
            ) : (
              <StaggerGrid className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {visibleUpcoming.map((m) => (
                  <StaggerItem key={m.id}>
                    <UpcomingCard m={m} />
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════
          TAB 4 — Dynamic Form Index
      ════════════════════════════════════════════════════ */}
      {activeTab === "form" && (
        <section className="px-4 sm:px-6 mb-14">
          <div className="max-w-6xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-4 sm:px-10 py-8 sm:py-10">
            <FadeUp>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-[#0071e3]" />
                <h2 className="text-lg sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                  Dynamic Form Index
                </h2>
              </div>
              <p className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-8 max-w-2xl">
                Multiplicative ELO-style index for all 48 teams, seeded from
                open betting-market momentum (baseline 1.00). Winning against
                the odds earns an outsized boost, scaled by goal margin and
                the match&apos;s real expected-goals balance. Scroll to
                explore the full field.
              </p>
            </FadeUp>

            <FadeUp delay={0.08}>
              {/* Scrollable viewport — the inner chart is tall enough to give
                  every one of the 48 teams its own readable row */}
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto rounded-2xl bg-white/40 dark:bg-black/20 pr-1">
                <div
                  className="text-[#6e6e73] dark:text-[#8e8e93] min-w-[320px]"
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
                        width={110}
                        interval={0}
                        tick={{ fill: "currentColor", fontSize: 11, fontWeight: 600 }}
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
      )}

      {/* ════════════════════════════════════════════════════
          TAB 5 — AI Telemetry Insights
      ════════════════════════════════════════════════════ */}
      {activeTab === "telemetry" && (
        <section className="px-4 sm:px-6 mb-14">
          <div className="max-w-6xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-4 sm:px-10 py-8 sm:py-10">
            <FadeUp>
              <div className="flex items-center gap-3 mb-2">
                <BrainCircuit className="w-5 h-5 text-[#0071e3]" />
                <h2 className="text-lg sm:text-2xl font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                  AI Telemetry Insights
                </h2>
              </div>
              <p className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#8e8e93] mb-7 max-w-2xl">
                Aggregate view of the advanced telemetry generated by the AI
                scraping layer across every resolved fixture — how actual
                output compares to the underlying expected-goals model.
                Per-match narratives and hybrid verdicts are available from
                the Match Tracking tab.
              </p>
            </FadeUp>
            {telemetryPoints.length === 0 ? (
              <FadeUp>
                <div className="rounded-3xl border-2 border-dashed border-[#d2d2d7] dark:border-[#3a3a3c] py-12 text-center">
                  <p className="text-sm font-medium text-[#6e6e73] dark:text-[#8e8e93]">
                    No results yet — AI telemetry is generated shortly after
                    each match&apos;s final whistle.
                  </p>
                </div>
              </FadeUp>
            ) : (
              <>
                <FadeUp delay={0.05}>
                  <div className="mb-4">
                    <GenAIBadge size="sm" />
                  </div>
                </FadeUp>

                <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4">
                  <StaggerItem>
                    <Kpi icon={Target} label="Avg xG per Performance"
                         value={(telemetryPoints.reduce((s, p) => s + p.xg, 0) / telemetryPoints.length).toFixed(2)}
                         sub={`across ${telemetryPoints.length} team performances`} />
                  </StaggerItem>
                  <StaggerItem>
                    <Kpi icon={Goal} label="Avg Goals per Performance"
                         value={(telemetryPoints.reduce((s, p) => s + p.goals, 0) / telemetryPoints.length).toFixed(2)}
                         sub="actual output across the same sample" color={SKY} />
                  </StaggerItem>
                  <StaggerItem>
                    <Kpi icon={TrendingUp} label="Overperformed xG"
                         value={`${telemetryPoints.filter((p) => p.goals > p.xg).length}`}
                         sub="scored more than the model expected" color={GREEN} />
                  </StaggerItem>
                  <StaggerItem>
                    <Kpi icon={TrendingDown} label="Underperformed xG"
                         value={`${telemetryPoints.filter((p) => p.goals < p.xg).length}`}
                         sub="scored less than the model expected" color={RED} />
                  </StaggerItem>
                </StaggerGrid>

                <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
                  {/* Scatter — xG vs Actual Goals */}
                  <FadeUp delay={0.08}>
                    <div className="rounded-3xl bg-white dark:bg-[#2c2c2e] p-4 sm:p-6">
                      <h3 className="text-sm sm:text-base font-bold text-[#1d1d1f] dark:text-white mb-1">
                        Expected vs Actual Goals
                      </h3>
                      <p className="text-[11px] sm:text-[12px] text-[#86868b] dark:text-[#8e8e93] mb-4">
                        One point per team per fixture. Above the dashed line
                        means the team scored more than its xG; below means
                        it underperformed its chances.
                      </p>
                      <div style={{ height: 320 }} className="text-[#6e6e73] dark:text-[#8e8e93]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                            <CartesianGrid stroke="currentColor" strokeOpacity={0.08} />
                            <XAxis
                              type="number" dataKey="xg" name="Expected Goals (xG)"
                              domain={[0, telemetryMax]}
                              tick={{ fill: "currentColor", fontSize: 11 }}
                              axisLine={false} tickLine={false}
                              label={{ value: "xG", position: "insideBottom", offset: -4, fill: "currentColor", fontSize: 11 }}
                            />
                            <YAxis
                              type="number" dataKey="goals" name="Actual Goals"
                              domain={[0, telemetryMax]}
                              tick={{ fill: "currentColor", fontSize: 11 }}
                              axisLine={false} tickLine={false}
                              label={{ value: "Goals", angle: -90, position: "insideLeft", fill: "currentColor", fontSize: 11 }}
                            />
                            <ReferenceLine
                              segment={[{ x: 0, y: 0 }, { x: telemetryMax, y: telemetryMax }]}
                              stroke="currentColor" strokeOpacity={0.25} strokeDasharray="4 4"
                              ifOverflow="extendDomain"
                            />
                            <Tooltip content={<TelemetryScatterTip />} cursor={{ strokeDasharray: "3 3" }} />
                            <Scatter data={telemetryPoints}>
                              {telemetryPoints.map((p, i) => (
                                <Cell key={`${p.matchId}-${p.team}-${i}`} fill={p.goals >= p.xg ? GREEN : RED} />
                              ))}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </FadeUp>

                  {/* Bar — Shot conversion rate */}
                  <FadeUp delay={0.12}>
                    <div className="rounded-3xl bg-white dark:bg-[#2c2c2e] p-4 sm:p-6">
                      <h3 className="text-sm sm:text-base font-bold text-[#1d1d1f] dark:text-white mb-1">
                        Shot Conversion Rate
                      </h3>
                      <p className="text-[11px] sm:text-[12px] text-[#86868b] dark:text-[#8e8e93] mb-4">
                        Goals scored as a share of total shots taken, per
                        team performance.
                      </p>
                      <div
                        style={{ height: Math.max(160, conversionData.length * 40 + 40) }}
                        className="text-[#6e6e73] dark:text-[#8e8e93]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={conversionData}
                            layout="vertical"
                            margin={{ top: 8, right: 28, bottom: 8, left: 8 }}
                          >
                            <XAxis
                              type="number" domain={[0, "auto"]}
                              tickFormatter={(v: number) => `${v}%`}
                              tick={{ fill: "currentColor", fontSize: 11 }}
                              axisLine={false} tickLine={false}
                            />
                            <YAxis
                              type="category" dataKey="team" width={100} interval={0}
                              tick={{ fill: "currentColor", fontSize: 11, fontWeight: 600 }}
                              axisLine={false} tickLine={false}
                            />
                            <Tooltip content={<ConversionTip />} cursor={{ fill: "rgba(0,113,227,0.05)" }} />
                            <Bar dataKey="conversion" radius={[0, 8, 8, 0]} barSize={16} fill={BLUE} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </FadeUp>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
