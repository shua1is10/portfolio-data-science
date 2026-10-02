import type { Num } from "../types";

const DASH = "—";

export function fmtNum(v: Num | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: Num | undefined, digits = 1): string {
  return v === null || v === undefined ? DASH : `${fmtNum(v, digits)}%`;
}

/** Signed percentage change, e.g. +22% / −20% (true minus sign). */
export function fmtDelta(v: Num | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const s = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return `${v >= 0 ? "+" : "−"}${s}%`;
}

export function fmtCompact(v: Num | undefined): string {
  if (v === null || v === undefined) return DASH;
  return v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}

export function fmtP(p: Num | undefined): string {
  if (p === null || p === undefined) return DASH;
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}
