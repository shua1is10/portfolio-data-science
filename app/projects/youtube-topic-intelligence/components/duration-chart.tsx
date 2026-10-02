"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs } from "@/components/ui/tabs";
import type { PeriodKey } from "../types";
import type { BinMetric, BinPoint } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtCompact, fmtPct } from "./format";
import { PeriodLegend } from "./period-legend";
import { VizTooltip } from "./viz-tooltip";
import { AXIS_TICK, SERIES } from "./viz-theme";

/** Bins with fewer videos than this render faded: their medians are unstable. */
const MIN_N = 15;

const METRICS: { value: BinMetric; label: string }[] = [
  { value: "engagement", label: "Engagement ratio" },
  { value: "velocity", label: "Views / day" },
];

/** Video length vs performance, by duration band. Velocity is shown within each year
 *  only: last year's videos are older, so their views/day are not comparable. */
export function DurationChart({ data, metric, onMetricChange, visible, prevLabel, currLabel }: {
  data: BinPoint[];
  metric: BinMetric;
  onMetricChange: (m: BinMetric) => void;
  visible: PeriodKey[];
  prevLabel: string;
  currLabel: string;
}) {
  const labelOf = { prev: prevLabel, curr: currLabel };
  const fmt = (v: number | null) => (metric === "engagement" ? fmtPct(v, 2) : fmtCompact(v));

  return (
    <ChartCard
      title="Video length vs performance"
      subtitle={metric === "engagement"
        ? "Median engagement ratio by duration band"
        : "Median views per day by duration band (videos ≥ 14 days old)"}
      legend={
        <div className="space-y-3">
          <Tabs items={METRICS.map(({ value, label }) => ({ value, label }))} value={metric}
            onValueChange={(v) => onMetricChange(v as BinMetric)} />
          <PeriodLegend prevLabel={prevLabel} currLabel={currLabel} show={visible} />
        </div>
      }
      table={{
        columns: ["Duration", ...visible.flatMap((p) => [labelOf[p], "n"])],
        rows: data.map((d) => [
          d.label,
          ...visible.flatMap((p) => (p === "prev" ? [fmt(d.prevValue), d.prevN] : [fmt(d.currValue), d.currN])),
        ]),
      }}
      footnote={
        metric === "velocity"
          ? `Compare bands within a year, not across years: last year's videos have had more time to accumulate views. Faded bars: fewer than ${MIN_N} videos.`
          : `Faded bars: fewer than ${MIN_N} videos in the band.`
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--yt-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48}
            tickFormatter={(v: number) => (metric === "engagement" ? `${v}%` : fmtCompact(v))} />
          <Tooltip
            cursor={{ fill: "var(--yt-grid)" }}
            content={(p) => (
              <VizTooltip
                {...p}
                formatValue={(v) => fmt(v)}
                footer={(d) => visible.map((k) => `${labelOf[k]}: n = ${String(d[k === "prev" ? "prevN" : "currN"])}`).join(" · ")}
              />
            )}
          />
          {visible.map((p) => (
            <Bar key={p} dataKey={p === "prev" ? "prevValue" : "currValue"} name={labelOf[p]} fill={SERIES[p]}
              radius={[4, 4, 0, 0]} maxBarSize={24}>
              {data.map((d) => (
                <Cell key={d.label} fillOpacity={(p === "prev" ? d.prevN : d.currN) < MIN_N ? 0.35 : 1} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
