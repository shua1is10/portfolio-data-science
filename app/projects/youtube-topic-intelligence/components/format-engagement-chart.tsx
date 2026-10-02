"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeriodKey } from "../types";
import type { BinPoint } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtPct } from "./format";
import { PeriodLegend } from "./period-legend";
import { VizTooltip } from "./viz-tooltip";
import { AXIS_TICK, SERIES } from "./viz-theme";

/** Bins with fewer videos than this render faded: their medians are unstable. */
const MIN_N = 20;

export function FormatEngagementChart({ data, visible, prevLabel, currLabel }: {
  data: BinPoint[];
  visible: PeriodKey[];
  prevLabel: string;
  currLabel: string;
}) {
  const labelOf = { prev: prevLabel, curr: currLabel };
  const series = visible.map((p) => ({
    key: p,
    dataKey: p === "prev" ? "prevEer" : "currEer",
    nKey: p === "prev" ? "prevN" : "currN",
    color: SERIES[p],
  }));

  return (
    <ChartCard
      title="Video length vs engagement efficiency"
      subtitle="Median EER by duration band — where interaction concentrates"
      legend={<PeriodLegend prevLabel={prevLabel} currLabel={currLabel} show={visible} />}
      table={{
        columns: ["Duration", ...visible.flatMap((p) => [`${labelOf[p]} EER`, "n"])],
        rows: data.map((d) => [
          d.label,
          ...visible.flatMap((p) => (p === "prev" ? [fmtPct(d.prevEer, 2), d.prevN] : [fmtPct(d.currEer, 2), d.currN])),
        ]),
      }}
      footnote={`Faded bars: fewer than ${MIN_N} videos in the band.`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--yt-grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "var(--yt-grid)" }}
            content={(p) => (
              <VizTooltip
                {...p}
                formatValue={(v) => fmtPct(v, 2)}
                footer={(d) => visible.map((k) => `${labelOf[k]}: n = ${String(d[k === "prev" ? "prevN" : "currN"])}`).join(" · ")}
              />
            )}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.dataKey} name={labelOf[s.key]} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22}>
              {data.map((d) => (
                <Cell key={d.label} fillOpacity={(s.key === "prev" ? d.prevN : d.currN) < MIN_N ? 0.35 : 1} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
