"use client";

import { useMemo } from "react";
import type { KnockoutMatch } from "./engine-dashboard";

/* ── Palette (mirrors engine-dashboard tokens) ──────────────────────────── */
const BLUE  = "#0071e3";
const GREEN = "#30d158";
const MUTED = "#86868b";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtPct(p: number | null): string {
  return p === null ? "—" : `${Math.round(p * 100)}%`;
}

function resolveWinner(match: KnockoutMatch): string | null {
  if (match.projectedWinner) return match.projectedWinner;
  if (match.probA !== null && match.probB !== null) {
    return match.probA >= match.probB ? match.teamA : match.teamB;
  }
  return null;
}

/* ── MatchCard ───────────────────────────────────────────────────────────── */
function MatchCard({ match }: { match: KnockoutMatch }) {
  const hasProbs = match.probA !== null && match.probB !== null;
  const winner   = resolveWinner(match);

  const dimA = winner !== null && winner !== match.teamA;
  const dimB = winner !== null && winner !== match.teamB;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#2c2c2e] border border-[#e8e8ed] dark:border-[#3a3a3c] p-3 shadow-sm h-full">
      {/* Match ID chip */}
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#86868b] dark:text-[#8e8e93] mb-2">
        {match.id}
      </p>

      {/* Team A */}
      <div className={`flex items-center justify-between gap-1 transition-opacity ${dimA ? "opacity-35" : ""}`}>
        <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-white truncate">
          {match.teamA}
        </span>
        {hasProbs && (
          <span
            className="text-[11px] font-bold tabular-nums shrink-0"
            style={{ color: winner === match.teamA ? BLUE : MUTED }}
          >
            {fmtPct(match.probA)}
          </span>
        )}
      </div>

      {/* Binary probability bar */}
      {hasProbs && (
        <div className="relative h-[3px] rounded-full bg-[#f0f0f5] dark:bg-[#3a3a3c] overflow-hidden my-1.5">
          <div
            className="absolute left-0 h-full rounded-full"
            style={{ width: fmtPct(match.probA), backgroundColor: BLUE }}
          />
        </div>
      )}

      {/* Team B */}
      <div className={`flex items-center justify-between gap-1 transition-opacity ${dimB ? "opacity-35" : ""}`}>
        <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-white truncate">
          {match.teamB}
        </span>
        {hasProbs && (
          <span
            className="text-[11px] font-bold tabular-nums shrink-0"
            style={{ color: winner === match.teamB ? BLUE : MUTED }}
          >
            {fmtPct(match.probB)}
          </span>
        )}
      </div>

      {/* AI projected winner label */}
      {winner && (
        <p
          className="mt-2 pt-1.5 border-t border-[#f0f0f5] dark:border-[#3a3a3c] text-[9px] font-bold uppercase tracking-[0.1em]"
          style={{ color: GREEN }}
        >
          AI → {winner}
        </p>
      )}
    </div>
  );
}

/* ── R16 projected slot ─────────────────────────────────────────────────── */
function R16Slot({
  label, teamA, teamB,
}: {
  label: string;
  teamA: string | null;
  teamB: string | null;
}) {
  const ready = teamA && teamB;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] border-2 border-dashed border-[#d2d2d7] dark:border-[#3a3a3c] p-3 w-full">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#86868b] dark:text-[#8e8e93] mb-1.5">
        {label}
      </p>
      {ready ? (
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold text-[#1d1d1f] dark:text-white truncate">{teamA}</p>
          <p className="text-[9px] text-[#86868b] dark:text-[#8e8e93]">vs</p>
          <p className="text-[11px] font-bold text-[#1d1d1f] dark:text-white truncate">{teamB}</p>
        </div>
      ) : (
        <p className="text-[11px] italic text-[#86868b] dark:text-[#8e8e93]">TBD</p>
      )}
    </div>
  );
}

/* ── BracketPair ─────────────────────────────────────────────────────────── */
function BracketPair({
  top, bottom, r16Label,
}: {
  top:      KnockoutMatch;
  bottom:   KnockoutMatch;
  r16Label: string;
}) {
  const winnerTop    = resolveWinner(top);
  const winnerBottom = resolveWinner(bottom);

  return (
    <div className="flex items-stretch gap-0">
      {/* Two R32 match cards */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex-1">
          <MatchCard match={top} />
        </div>
        <div className="flex-1">
          <MatchCard match={bottom} />
        </div>
      </div>

      {/* Bracket connector — top arm (border-right + border-bottom) and
          bottom arm (border-right + border-top) form an L-bracket */}
      <div className="w-5 shrink-0 flex flex-col">
        <div className="flex-1 border-r-2 border-b-2 border-[#d2d2d7] dark:border-[#3a3a3c] rounded-br-lg" />
        <div className="flex-1 border-r-2 border-t-2 border-[#d2d2d7] dark:border-[#3a3a3c] rounded-tr-lg" />
      </div>

      {/* Projected R16 slot */}
      <div className="w-[132px] shrink-0 flex items-center pl-1.5">
        <R16Slot
          label={r16Label}
          teamA={winnerTop}
          teamB={winnerBottom}
        />
      </div>
    </div>
  );
}

/* ── KnockoutTree (exported) ─────────────────────────────────────────────── */
export function KnockoutTree({ bracket }: { bracket: KnockoutMatch[] }) {
  const r32 = useMemo(
    () =>
      [...bracket].sort(
        (a, b) =>
          Number(a.id.replace("R32-", "")) - Number(b.id.replace("R32-", ""))
      ),
    [bracket]
  );

  /* Group sorted R32 matches into pairs: (0,1), (2,3) … (14,15) */
  const pairs = useMemo<[KnockoutMatch, KnockoutMatch][]>(() => {
    const out: [KnockoutMatch, KnockoutMatch][] = [];
    for (let i = 0; i + 1 < r32.length; i += 2) {
      out.push([r32[i], r32[i + 1]]);
    }
    return out;
  }, [r32]);

  const leftPairs  = pairs.slice(0, 4); // R32 1-8  → R16 1-4
  const rightPairs = pairs.slice(4, 8); // R32 9-16 → R16 5-8

  const SideLabel = ({ label }: { label: string }) => (
    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#86868b] dark:text-[#8e8e93] mb-2 pl-0.5">
      {label}
    </p>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* ── Left bracket: matches 1-8 ──────────────────────── */}
      <div className="space-y-3">
        <SideLabel label="Left Bracket — R32 matches 1–8" />
        {leftPairs.map((pair, i) => (
          <BracketPair
            key={pair[0].id}
            top={pair[0]}
            bottom={pair[1]}
            r16Label={`R16-${i + 1}`}
          />
        ))}
      </div>

      {/* ── Right bracket: matches 9-16 ────────────────────── */}
      <div className="space-y-3">
        <SideLabel label="Right Bracket — R32 matches 9–16" />
        {rightPairs.map((pair, i) => (
          <BracketPair
            key={pair[0].id}
            top={pair[0]}
            bottom={pair[1]}
            r16Label={`R16-${i + 5}`}
          />
        ))}
      </div>
    </div>
  );
}
