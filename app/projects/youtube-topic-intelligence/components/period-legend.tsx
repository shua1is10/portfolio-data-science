import { cn } from "@/lib/utils";
import { SERIES } from "./viz-theme";

/** Two-series legend. Text stays in ink colors; the swatch alone carries identity. */
export function PeriodLegend({ prevLabel, currLabel, show = ["prev", "curr"], className }: {
  prevLabel: string;
  currLabel: string;
  show?: ("prev" | "curr")[];
  className?: string;
}) {
  const items = [
    { key: "prev" as const, label: prevLabel, color: SERIES.prev },
    { key: "curr" as const, label: currLabel, color: SERIES.curr },
  ].filter((i) => show.includes(i.key));

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
