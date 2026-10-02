"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeriodKey } from "../types";
import type { SharePoint } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtPct } from "./format";
import { PeriodLegend } from "./period-legend";
import { VizTooltip } from "./viz-tooltip";
import { AXIS_TICK, SERIES } from "./viz-theme";

/** Topic dynamics: each subtopic's share of the period's uploads. Shares (not counts)
 *  so a growing market does not make every subtopic look like it is "winning". */
export function TopicShareChart({ data, visible, prevLabel, currLabel }: {
  data: SharePoint[];
  visible: PeriodKey[];
  prevLabel: string;
  currLabel: string;
}) {
  const labelOf = { prev: prevLabel, curr: currLabel };
  return (
    <ChartCard
      title="Subtopic share of surfaced videos"
      subtitle="Share of the videos YouTube surfaces for the topic, by subtopic"
      legend={<PeriodLegend prevLabel={prevLabel} currLabel={currLabel} show={visible} />}
      table={{
        columns: ["Subtopic", ...visible.map((p) => labelOf[p])],
        rows: data.map((d) => [d.label, ...visible.map((p) => fmtPct(p === "prev" ? d.prevShare : d.currShare, 1))]),
      }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" barGap={2} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--yt-grid)" />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS_TICK, fontSize: 11.5 }} axisLine={false} tickLine={false} width={142} />
          <Tooltip
            cursor={{ fill: "var(--yt-grid)" }}
            content={(p) => (
              <VizTooltip
                {...p}
                formatValue={(v) => fmtPct(v, 1)}
                footer={(d) => visible.map((k) => `${labelOf[k]}: ${String(d[k === "prev" ? "prevN" : "currN"])} videos`).join(" · ")}
              />
            )}
          />
          {visible.includes("prev") && <Bar dataKey="prevShare" name={prevLabel} fill={SERIES.prev} radius={[0, 4, 4, 0]} maxBarSize={12} />}
          {visible.includes("curr") && <Bar dataKey="currShare" name={currLabel} fill={SERIES.curr} radius={[0, 4, 4, 0]} maxBarSize={12} />}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
