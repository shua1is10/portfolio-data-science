"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/** Chart container with an accessible table view (the same numbers, readable without
 *  color or hover). Every dashboard chart goes through this card. */
export function ChartCard({
  title, subtitle, legend, table, footnote, className, children,
}: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  table?: ChartTable;
  footnote?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);

  return (
    // min-w-0: as a grid item it must not grow to its content's min width (wide tables, the matrix)
    <section className={cn("min-w-0 rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-5 sm:p-6 flex flex-col", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-[#86868b] leading-snug">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold bg-white dark:bg-[#2c2c2e] text-[#515154] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50"
          >
            {asTable ? <BarChart3 className="w-3.5 h-3.5" aria-hidden /> : <Table2 className="w-3.5 h-3.5" aria-hidden />}
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </header>
      {legend && !asTable && <div className="mt-3">{legend}</div>}

      <div className="mt-4 flex-1 min-h-0">
        {asTable && table ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] tabular-nums">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.06em] text-[#86868b]">
                  {table.columns.map((c, i) => (
                    <th key={c} className={cn("py-2 pr-3 font-semibold", i > 0 && "text-right")}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-black/5 dark:border-white/10">
                    {r.map((cell, j) => (
                      <td key={j} className={cn("py-2 pr-3 text-[#1d1d1f] dark:text-[#f5f5f7]", j > 0 && "text-right")}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
      {footnote && <p className="mt-3 text-[11px] leading-relaxed text-[#86868b]">{footnote}</p>}
    </section>
  );
}
