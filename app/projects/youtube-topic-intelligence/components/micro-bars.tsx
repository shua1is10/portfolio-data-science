import type { Highlight } from "../types";
import { fmtNum } from "./format";
import { SERIES } from "./viz-theme";

/** Tiny prior-vs-current bar pairs for a highlight card. Plain HTML bars (not a scaled
 *  SVG) so labels keep a readable font size at any card width. Direct value labels on
 *  every bar — at most four values, so they never crowd. Requires an ancestor carrying
 *  VIZ_VARS for the series colors. */
export function MicroBars({ bars, unit }: { bars: Highlight["bars"]; unit: string }) {
  const max = Math.max(...bars.flatMap((b) => [b.prev ?? 0, b.curr ?? 0]), 1);
  const digits = unit === "videos" ? 0 : 1;
  const suffix = unit === "videos" ? "" : "%";

  return (
    <div
      role="img"
      aria-label={bars
        .map((b) => `${b.label}: prior ${fmtNum(b.prev, digits)}, current ${fmtNum(b.curr, digits)} ${unit}`)
        .join("; ")}
      className="space-y-3"
    >
      {bars.map((b) => (
        <div key={b.label}>
          {bars.length > 1 && (
            <p className="mb-1 text-[11px] font-semibold text-[#86868b]">{b.label}</p>
          )}
          {([["prev", b.prev], ["curr", b.curr]] as const).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 h-[18px]">
              <span
                className="h-2.5 rounded-[4px] shrink-0"
                style={{ width: `${Math.max(((value ?? 0) / max) * 78, 2)}%`, background: SERIES[key] }}
                aria-hidden
              />
              <span className="text-[11.5px] font-semibold tabular-nums">
                {fmtNum(value, digits)}{suffix}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
