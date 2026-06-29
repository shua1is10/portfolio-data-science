"use client";

import { useMemo } from "react";
import type { KnockoutMatch } from "./engine-dashboard";

/* ─────────────────────────────────────────────────────────────────────────
   Layout constants — tweak here to adjust sizing
────────────────────────────────────────────────────────────────────────── */
const SLOT_H  = 68;          // height of one R32 "slot" (px)
const NODE_H  = 52;          // match-card height (px)
const NODE_W  = 152;         // match-card width (px)
const CONN_W  = 34;          // connector column width (px)
const TOTAL_H = 16 * SLOT_H; // 1088 px — total bracket height

const ROUND_LABELS = [
  "Round of 32",
  "Round of 16",
  "Quarter-Finals",
  "Semi-Finals",
  "Final",
];

/* ─────────────────────────────────────────────────────────────────────────
   Internal bracket match type
────────────────────────────────────────────────────────────────────────── */
interface BM {
  id: string;
  teamA: string;
  teamB: string;
  probA: number | null;
  probB: number | null;
  projectedWinner: string | null;
  r: number;  // 0 = R32 … 4 = Final
  i: number;  // 0-based index within the round
}

/* ─────────────────────────────────────────────────────────────────────────
   Geometry — bracket positioning
────────────────────────────────────────────────────────────────────────── */

/** Absolute center-Y of a match card in round r, index i. */
function cy(r: number, i: number): number {
  return SLOT_H * (i * Math.pow(2, r) + Math.pow(2, r) / 2);
}

/** Absolute top of a match card (for CSS `top`). */
function cardTop(r: number, i: number): number {
  return cy(r, i) - NODE_H / 2;
}

/* ─────────────────────────────────────────────────────────────────────────
   Winner resolver (uses projectedWinner then falls back to highest prob)
────────────────────────────────────────────────────────────────────────── */
function resolveWinner(m: BM): string | null {
  if (m.projectedWinner) return m.projectedWinner;
  if (m.probA !== null && m.probB !== null) {
    return m.probA >= m.probB ? m.teamA : m.teamB;
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Build the full 5-round bracket from R32 data only.
   Rounds R16 → Final are auto-derived by cascading projected winners.
────────────────────────────────────────────────────────────────────────── */
function buildBracket(r32: KnockoutMatch[]): BM[][] {
  const sorted = [...r32].sort(
    (a, b) =>
      Number(a.id.replace("R32-", "")) - Number(b.id.replace("R32-", ""))
  );

  const round0: BM[] = sorted.map((m, idx) => ({
    id: m.id,
    teamA: m.teamA, teamB: m.teamB,
    probA: m.probA, probB: m.probB,
    projectedWinner: m.projectedWinner,
    r: 0, i: idx,
  }));

  const allRounds: BM[][] = [round0];
  const ids = ["R16", "QF", "SF", "F"];

  let prev = round0;
  for (let rIdx = 0; rIdx < 4; rIdx++) {
    const next: BM[] = [];
    for (let j = 0; j < prev.length; j += 2) {
      const a = prev[j];
      const b = prev[j + 1];
      const wA = resolveWinner(a) ?? "TBD";
      const wB = b ? (resolveWinner(b) ?? "TBD") : "TBD";
      next.push({
        id:    `${ids[rIdx]}-${Math.floor(j / 2) + 1}`,
        teamA: wA, teamB: wB,
        probA: null, probB: null, projectedWinner: null,
        r: rIdx + 1, i: Math.floor(j / 2),
      });
    }
    allRounds.push(next);
    prev = next;
  }

  return allRounds;
}

/* ─────────────────────────────────────────────────────────────────────────
   Connector SVG — sits between two consecutive round columns.
   Draws right-stubs, a vertical bar, and a horizontal line to the parent.
────────────────────────────────────────────────────────────────────────── */
function Connector({ round, matchCount }: { round: number; matchCount: number }) {
  const paths: string[] = [];

  for (let i = 0; i < matchCount; i += 2) {
    const yTop  = cy(round, i);
    const yBot  = cy(round, i + 1);
    const yPar  = cy(round + 1, Math.floor(i / 2));
    const xMid  = CONN_W / 2;

    paths.push(
      `M 0 ${yTop} H ${xMid}`,           // stub: top match → centre
      `M 0 ${yBot} H ${xMid}`,           // stub: bottom match → centre
      `M ${xMid} ${yTop} V ${yBot}`,     // vertical bar connecting pair
      `M ${xMid} ${yPar} H ${CONN_W}`,   // horizontal → next-round card
    );
  }

  return (
    <svg
      width={CONN_W}
      height={TOTAL_H}
      style={{ display: "block", flexShrink: 0 }}
      className="overflow-visible"
      aria-hidden
    >
      {paths.map((d, k) => (
        <path
          key={k} d={d} fill="none"
          stroke="#d2d2d7" strokeWidth={1.5} strokeLinecap="round"
          className="dark:stroke-[#3a3a3c]"
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Compact Match Card — absolutely positioned within a round column
────────────────────────────────────────────────────────────────────────── */
function MatchCard({ m }: { m: BM }) {
  const w        = resolveWinner(m);
  const hasProbs = m.probA !== null && m.probB !== null;
  const isFinal  = m.r === 4;

  const TeamRow = ({
    team, prob, isWin, isLose,
  }: { team: string; prob: number | null; isWin: boolean; isLose: boolean }) => (
    <div
      className={`flex items-center justify-between gap-1 px-2 flex-1 min-h-0 transition-opacity duration-200 ${
        isLose ? "opacity-25" : ""
      }`}
    >
      <span
        className="text-[10px] font-semibold leading-tight truncate"
        style={{ color: isWin ? "#0071e3" : undefined }}
      >
        {team}
      </span>
      {hasProbs && prob !== null && (
        <span
          className="text-[10px] font-bold tabular-nums shrink-0"
          style={{ color: isWin ? "#0071e3" : "#86868b" }}
        >
          {Math.round(prob * 100)}%
        </span>
      )}
    </div>
  );

  const aWins = w === m.teamA;
  const bWins = w === m.teamB;

  return (
    <div
      className={`absolute left-0 flex flex-col overflow-hidden rounded-xl shadow-sm border ${
        isFinal
          ? "border-[#f5c400] dark:border-[#b38e00]"
          : "border-[#e8e8ed] dark:border-[#3a3a3c]"
      } bg-white dark:bg-[#2c2c2e]`}
      style={{ top: cardTop(m.r, m.i), width: NODE_W, height: NODE_H }}
    >
      {/* Team A row */}
      <div className="border-b border-[#f0f0f5] dark:border-[#3a3a3c] flex-1 min-h-0 flex items-stretch">
        <TeamRow team={m.teamA} prob={m.probA} isWin={aWins} isLose={w !== null && !aWins} />
      </div>

      {/* Team B row */}
      <div className="flex-1 min-h-0 flex items-stretch">
        <TeamRow team={m.teamB} prob={m.probB} isWin={bWins} isLose={w !== null && !bWins} />
      </div>

      {/* Probability fill bar (bottom edge) */}
      {hasProbs && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f0f0f5] dark:bg-[#3a3a3c]">
          <div
            className="h-full bg-[#0071e3] rounded-r-full"
            style={{ width: `${Math.round((m.probA ?? 0) * 100)}%` }}
          />
        </div>
      )}

      {/* Final champion label */}
      {isFinal && w && (
        <span className="absolute bottom-[3px] right-[5px] text-[7px] font-extrabold tracking-[0.06em] uppercase text-[#a07d00] dark:text-[#f5c400]">
          Champion
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Round Column — label + absolutely-positioned match cards
────────────────────────────────────────────────────────────────────────── */
function RoundCol({ matches, label }: { matches: BM[]; label: string }) {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
      {/* Round label */}
      <p
        className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#86868b] dark:text-[#8e8e93] mb-2 text-center"
        style={{ width: NODE_W }}
      >
        {label}
      </p>

      {/* Positioned container */}
      <div className="relative" style={{ width: NODE_W, height: TOTAL_H }}>
        {matches.map((m) => (
          <MatchCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   KnockoutTree — public export
────────────────────────────────────────────────────────────────────────── */
export function KnockoutTree({ bracket }: { bracket: KnockoutMatch[] }) {
  const rounds = useMemo(() => buildBracket(bracket), [bracket]);

  return (
    /* Outer wrapper: horizontal scroll on overflow */
    <div
      className="overflow-x-auto pb-4"
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      {/* Inner flex-row: all round columns + connectors */}
      <div
        className="flex flex-row items-start"
        style={{ minWidth: "max-content" }}
      >
        {rounds.map((roundMatches, r) => (
          <div key={r} className="flex flex-row items-start">
            <RoundCol matches={roundMatches} label={ROUND_LABELS[r]} />
            {/* Draw connector only between consecutive rounds, not after Final */}
            {r < rounds.length - 1 && (
              <Connector round={r} matchCount={roundMatches.length} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
