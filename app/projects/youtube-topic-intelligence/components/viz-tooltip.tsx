"use client";

import type { TooltipContentProps } from "recharts";

interface VizTooltipProps extends Partial<TooltipContentProps> {
  formatValue?: (value: number) => string;
  formatLabel?: (label: string | number) => string;
  /** Extra lines under the values, e.g. sample sizes; receives the hovered datum. */
  footer?: (datum: Record<string, unknown>) => React.ReactNode;
}

/** Glass tooltip matching the portfolio's other dashboards, typed against Recharts 3.
 *  Values and labels wear ink colors; only the swatch carries series identity. */
export function VizTooltip({ active, payload, label, formatValue, formatLabel, footer }: VizTooltipProps) {
  if (!active || !payload?.length) return null;
  const datum = (payload[0]?.payload ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-md shadow-lg px-3.5 py-2.5 min-w-[150px]">
      {label !== undefined && (
        <p className="text-[11px] font-medium text-[#6e6e73] dark:text-[#a1a1a6] mb-1.5">
          {formatLabel ? formatLabel(label) : label}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-[12px]">
            <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: p.color }} aria-hidden />
            <span className="text-[#6e6e73] dark:text-[#a1a1a6]">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-[#1d1d1f] dark:text-white">
              {typeof p.value === "number" ? (formatValue ? formatValue(p.value) : p.value.toLocaleString("en-US")) : "—"}
            </span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 text-[10.5px] text-[#86868b]">{footer(datum)}</div>}
    </div>
  );
}
