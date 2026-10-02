"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MixRow } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtNum, fmtPct } from "./format";
import { VizTooltip } from "./viz-tooltip";
import { AXIS_TICK } from "./viz-theme";

const TONES = [
  { key: "positive", label: "Positive", color: "var(--yt-div-pos)" },
  { key: "neutral", label: "Neutral", color: "var(--yt-div-mid-strong)" },
  { key: "negative", label: "Negative", color: "var(--yt-div-neg)" },
] as const;

/** 100%-stacked tone mix of organic comments (creator, link, spam and promotional comments
 *  removed). Blue/red poles with a gray middle, matching the matrix's diverging scale. */
export function SentimentMixChart({ rows }: { rows: MixRow[] }) {
  const height = Math.max(180, rows.length * 30 + 40);
  return (
    <ChartCard
      title="Comment sentiment mix"
      subtitle="Share of organic English comments by tone (VADER), pooled per subtopic"
      legend={
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {TONES.map((t) => (
            <li key={t.key} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: t.color }} aria-hidden />
              {t.label}
            </li>
          ))}
        </ul>
      }
      table={{
        columns: ["Group", "Positive", "Neutral", "Negative", "Comments"],
        rows: rows.map((r) => [r.label, fmtPct(r.positive, 1), fmtPct(r.neutral, 1), fmtPct(r.negative, 1), fmtNum(r.n)]),
      }}
      footnote="Excluded before scoring: comments by the creator or containing links, cross-video duplicates, coordinated brand promotion, and non-English text."
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" barCategoryGap={6} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--yt-grid)" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} axisLine={false}
            tickLine={false} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10.5 }} axisLine={false} tickLine={false} width={160} />
          <Tooltip
            cursor={{ fill: "var(--yt-grid)" }}
            content={(p) => (
              <VizTooltip {...p} formatValue={(v) => fmtPct(v, 1)}
                footer={(d) => `${fmtNum(d.n as number)} comments`} />
            )}
          />
          {TONES.map((t, i) => (
            <Bar key={t.key} dataKey={t.key} name={t.label} stackId="tone" fill={t.color} maxBarSize={18}
              stroke="var(--yt-surface)" strokeWidth={1}
              radius={i === 0 ? [4, 0, 0, 4] : i === TONES.length - 1 ? [0, 4, 4, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
