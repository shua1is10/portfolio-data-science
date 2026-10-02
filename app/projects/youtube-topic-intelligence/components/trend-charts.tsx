"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeriodKey } from "../types";
import type { MonthPoint } from "./aggregations";
import { ChartCard } from "./chart-card";
import { fmtNum, fmtPct } from "./format";
import { PeriodLegend } from "./period-legend";
import { VizTooltip } from "./viz-tooltip";
import { AXIS_TICK, MONTHS, SERIES } from "./viz-theme";

const monthLabel = (m: string | number) => MONTHS[Number(m) - 1] ?? String(m);

/** Publishing volume and interaction, month by month. Two charts sharing an x-axis
 *  instead of one dual-axis chart: uploads and EER live on unrelated scales. */
export function TrendCharts({ data, visible, prevLabel, currLabel }: {
  data: MonthPoint[];
  visible: PeriodKey[];
  prevLabel: string;
  currLabel: string;
}) {
  const show = (p: PeriodKey) => visible.includes(p);
  const legend = <PeriodLegend prevLabel={prevLabel} currLabel={currLabel} show={visible} />;
  const labelOf = { prev: prevLabel, curr: currLabel };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <ChartCard
        title="Uploads per month"
        subtitle="Supply: videos published in the topic, Jan–Sep"
        legend={legend}
        table={{
          columns: ["Month", ...visible.map((p) => labelOf[p])],
          rows: data.map((d) => [monthLabel(d.month), ...visible.map((p) => (p === "prev" ? d.prevUploads : d.currUploads))]),
        }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--yt-grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--yt-grid)" }}
              content={(p) => <VizTooltip {...p} formatLabel={monthLabel} formatValue={(v) => `${fmtNum(v)} videos`} />}
            />
            {show("prev") && <Bar dataKey="prevUploads" name={prevLabel} fill={SERIES.prev} radius={[4, 4, 0, 0]} maxBarSize={18} />}
            {show("curr") && <Bar dataKey="currUploads" name={currLabel} fill={SERIES.curr} radius={[4, 4, 0, 0]} maxBarSize={18} />}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Median engagement efficiency per month"
        subtitle="(likes + comments) / views × 100, median of videos published that month"
        legend={legend}
        table={{
          columns: ["Month", ...visible.map((p) => `${labelOf[p]} EER`)],
          rows: data.map((d) => [monthLabel(d.month), ...visible.map((p) => fmtPct(p === "prev" ? d.prevEer : d.currEer, 2))]),
        }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--yt-grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip
              cursor={{ stroke: "var(--yt-axis)", strokeDasharray: "3 3" }}
              content={(p) => <VizTooltip {...p} formatLabel={monthLabel} formatValue={(v) => fmtPct(v, 2)} />}
            />
            {show("prev") && (
              <Line dataKey="prevEer" name={prevLabel} stroke={SERIES.prev} strokeWidth={2} type="monotone"
                dot={{ r: 3, fill: SERIES.prev, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            )}
            {show("curr") && (
              <Line dataKey="currEer" name={currLabel} stroke={SERIES.curr} strokeWidth={2} type="monotone"
                dot={{ r: 3, fill: SERIES.curr, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
