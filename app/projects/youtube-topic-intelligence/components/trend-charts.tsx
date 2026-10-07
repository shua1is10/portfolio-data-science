"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeriodKey } from "../types";
import type { MonthPoint } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtNum, fmtPct } from "./format";
import { PeriodLegend } from "./period-legend";
import { VizTooltip } from "./viz-tooltip";
import { AXIS_TICK, MONTHS, SERIES } from "./viz-theme";

const monthLabel = (m: string | number) => MONTHS[Number(m) - 1] ?? String(m);

/** Month-by-month video length and engagement. Two charts sharing an x-axis instead of
 *  one dual-axis chart: minutes and a percentage live on unrelated scales. Upload volume
 *  is deliberately absent — the sample takes a fixed number of videos per month. */
export function TrendCharts({ data, visible, prevLabel, currLabel }: {
  data: MonthPoint[];
  visible: PeriodKey[];
  prevLabel: string;
  currLabel: string;
}) {
  const legend = <PeriodLegend prevLabel={prevLabel} currLabel={currLabel} show={visible} />;
  const labelOf = { prev: prevLabel, curr: currLabel };
  const nFooter = (d: Record<string, unknown>) =>
    visible.map((k) => `${labelOf[k]}: n = ${String(d[k === "prev" ? "prevN" : "currN"])}`).join(" · ");

  const lines = (prefix: "Length" | "Engagement") =>
    visible.map((p) => (
      <Line
        key={p}
        dataKey={`${p}${prefix}`}
        name={labelOf[p]}
        stroke={SERIES[p]}
        strokeWidth={2}
        type="monotone"
        dot={{ r: 3, fill: SERIES[p], strokeWidth: 0 }}
        activeDot={{ r: 5 }}
        connectNulls
      />
    ));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <ChartCard
        title="Median video length per month"
        subtitle="Minutes, among the videos surfaced for the topic each month"
        legend={legend}
        table={{
          columns: ["Month", ...visible.map((p) => `${labelOf[p]} (min)`)],
          rows: data.map((d) => [monthLabel(d.month), ...visible.map((p) => fmtNum(p === "prev" ? d.prevLength : d.currLength, 1))]),
        }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--yt-grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${v}m`} />
            <Tooltip
              cursor={{ stroke: "var(--yt-axis)", strokeDasharray: "3 3" }}
              content={(p) => <VizTooltip {...p} formatLabel={monthLabel} formatValue={(v) => `${fmtNum(v, 1)} min`} footer={nFooter} />}
            />
            {lines("Length")}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Median engagement ratio per month"
        subtitle="(likes + comments) / views × 100, videos published that month"
        legend={legend}
        table={{
          columns: ["Month", ...visible.map((p) => `${labelOf[p]} engagement`)],
          rows: data.map((d) => [monthLabel(d.month), ...visible.map((p) => fmtPct(p === "prev" ? d.prevEngagement : d.currEngagement, 2))]),
        }}
        footnote="About 20 videos per month and period: read the overall direction, not single months."
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--yt-grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip
              cursor={{ stroke: "var(--yt-axis)", strokeDasharray: "3 3" }}
              content={(p) => <VizTooltip {...p} formatLabel={monthLabel} formatValue={(v) => fmtPct(v, 2)} footer={nFooter} />}
            />
            {lines("Engagement")}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
