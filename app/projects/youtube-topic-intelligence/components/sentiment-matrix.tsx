"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import type { Matrix, MatrixMetric } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtNum } from "./format";

const QUINTILES = ["Top 20%", "60–80%", "40–60%", "20–40%", "Bottom 20%"];
const ROWS = [4, 3, 2, 1, 0]; // quintile index, top performers first
const EXPECTED = 20; // % per cell if tone and performance were unrelated
const MIN_COLUMN_N = 15;

const METRICS: { value: MatrixMetric; label: string; long: string }[] = [
  { value: "engagement", label: "Interaction (engagement)", long: "engagement-ratio quintile" },
  { value: "rvi", label: "Reach (velocity index)", long: "Relative Velocity Index quintile" },
];

/** Diverging fill around the 20% no-relationship line: blue = over-represented,
 *  red = under-represented, gray = as expected. The value is printed in every cell,
 *  so color is never the only channel. */
function cellStyle(value: number, maxDev: number): { background: string; strong: boolean } {
  const dev = value - EXPECTED;
  const t = Math.min(Math.abs(dev) / maxDev, 1);
  const pole = dev >= 0 ? "var(--yt-div-pos)" : "var(--yt-div-neg)";
  return {
    background: `color-mix(in srgb, ${pole} ${Math.round(t * 85)}%, var(--yt-div-mid))`,
    strong: t > 0.55,
  };
}

export function SentimentMatrix({ matrix, metric, onMetricChange, sentimentLabels }: {
  matrix: Matrix;
  metric: MatrixMetric;
  onMetricChange: (m: MatrixMetric) => void;
  sentimentLabels: string[];
}) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const meta = METRICS.find((m) => m.value === metric) ?? METRICS[0];
  const usable = (c: number) => matrix.columnTotals[c] >= MIN_COLUMN_N;
  const maxDev = Math.max(
    8,
    ...matrix.cells.flatMap((row) => row.map((v, c) => (usable(c) ? Math.abs(v - EXPECTED) : 0))),
  );

  return (
    <ChartCard
      title="Sentiment × performance matrix"
      subtitle={`Within each comment-tone bucket, % of videos in each ${meta.long}. 20% everywhere would mean no relationship.`}
      legend={
        <Tabs
          items={METRICS.map(({ value, label }) => ({ value, label }))}
          value={metric}
          onValueChange={(v) => onMetricChange(v as MatrixMetric)}
        />
      }
      table={{
        columns: ["Quintile", ...sentimentLabels.map((l, c) => `${l} (n=${matrix.columnTotals[c]})`)],
        rows: ROWS.map((r, i) => [QUINTILES[i], ...matrix.cells[r].map((v) => `${v.toFixed(1)}%`)]),
      }}
      footnote={
        <>
          Spearman ρ (sentiment, {metric === "engagement" ? "engagement ratio" : "velocity quintile"}) ={" "}
          <strong className="font-semibold text-[#1d1d1f] dark:text-white">{fmtNum(matrix.rho, 2)}</strong>
          {" · "}n = {fmtNum(matrix.total)}. Columns with fewer than {MIN_COLUMN_N} videos are faded.
        </>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[460px]">
          <div className="grid grid-cols-[92px_repeat(5,minmax(0,1fr))] gap-[2px]" role="grid" aria-label={`Sentiment by ${meta.long}`}>
            <div />
            {sentimentLabels.map((l, c) => (
              <div key={l} role="columnheader" className="px-1 pb-1.5 text-center leading-tight">
                <span className="block text-[10.5px] font-semibold text-[#86868b]">{l}</span>
                <span className="block text-[9.5px] text-[#86868b]/80 tabular-nums">n = {matrix.columnTotals[c]}</span>
              </div>
            ))}
            {ROWS.map((r, i) => (
              <div key={r} role="row" className="contents">
                <div role="rowheader" className="pr-2 flex items-center justify-end text-[10.5px] font-semibold text-[#86868b] text-right leading-tight">
                  {QUINTILES[i]}
                </div>
                {matrix.cells[r].map((v, c) => {
                  const { background, strong } = cellStyle(v, maxDev);
                  const active = hover?.[0] === i && hover?.[1] === c;
                  return (
                    <div
                      key={c}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`${sentimentLabels[c]} tone, ${QUINTILES[i]}: ${v.toFixed(1)}% (${matrix.counts[r][c]} of ${matrix.columnTotals[c]} videos)`}
                      onMouseEnter={() => setHover([i, c])}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover([i, c])}
                      onBlur={() => setHover(null)}
                      className="h-12 rounded-[4px] flex items-center justify-center text-[11.5px] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                      style={{
                        background,
                        opacity: usable(c) ? 1 : 0.4,
                        boxShadow: active ? "inset 0 0 0 2px currentColor" : undefined,
                      }}
                    >
                      <span className={strong ? "text-white" : "text-[#1d1d1f] dark:text-white"}>{v.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[#86868b]">
            <p aria-live="polite" className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              {hover
                ? `${matrix.counts[ROWS[hover[0]]][hover[1]]} of ${matrix.columnTotals[hover[1]]} ${sentimentLabels[hover[1]].toLowerCase()} videos sit in the ${QUINTILES[hover[0]].toLowerCase()}`
                : "Hover or focus a cell for counts"}
            </p>
            <span className="inline-flex items-center gap-2">
              <span>Under-represented</span>
              <span
                className="h-2 w-32 rounded-full"
                style={{ background: "linear-gradient(90deg, var(--yt-div-neg), var(--yt-div-mid), var(--yt-div-pos))" }}
                aria-hidden
              />
              <span>Over-represented</span>
            </span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
