"use client";

import { ChevronDown } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import type { Filters, PeriodFilter } from "./aggregations";

/** One filter row above all charts: period · format · subtopic. */
export function FilterBar({
  value, onChange, formats, categories, prevLabel, currLabel,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  formats: { key: string; label: string }[];
  categories: { key: string; label: string }[];
  prevLabel: string;
  currLabel: string;
}) {
  const periodItems = [
    { value: "compare", label: "Year over year" },
    { value: "prev", label: prevLabel },
    { value: "curr", label: currLabel },
  ];
  const formatItems = [
    { value: "all", label: "All formats" },
    ...formats.map((f, i) => ({ value: String(i), label: f.label.replace(/\s*\(.*\)/, "") })),
  ];

  return (
    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
      <div role="group" aria-label="Period" className="min-w-0">
        <Tabs
          items={periodItems}
          value={value.period}
          onValueChange={(v) => onChange({ ...value, period: v as PeriodFilter })}
        />
      </div>
      <span className="hidden xl:block w-px h-6 bg-black/10 dark:bg-white/10" aria-hidden />
      <div role="group" aria-label="Format" className="min-w-0">
        <Tabs
          items={formatItems}
          value={value.format === "all" ? "all" : String(value.format)}
          onValueChange={(v) => onChange({ ...value, format: v === "all" ? "all" : Number(v) })}
        />
      </div>
      <label className="relative xl:ml-auto">
        <span className="sr-only">Subtopic</span>
        <select
          value={value.category === "all" ? "all" : String(value.category)}
          onChange={(e) => onChange({ ...value, category: e.target.value === "all" ? "all" : Number(e.target.value) })}
          className="appearance-none w-full xl:w-auto rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] pl-4 pr-9 py-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50"
        >
          <option value="all">All subtopics</option>
          {categories.map((c, i) => (
            <option key={c.key} value={String(i)}>{c.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" aria-hidden />
      </label>
    </div>
  );
}
