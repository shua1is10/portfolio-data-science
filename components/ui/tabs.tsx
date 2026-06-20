"use client";

import { cn } from "@/lib/utils";

/* Lightweight pill-style tab navigation — no external deps. Horizontally
 * scrollable on small screens so it never breaks layout with 5+ tabs. */

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ElementType;
}

export function Tabs({
  items,
  value,
  onValueChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1.5 sm:gap-2 overflow-x-auto pb-1",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-2 text-[12px] sm:text-[13px] font-semibold transition-colors duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/50",
              active
                ? "bg-[#0071e3] text-white shadow-[0_2px_10px_rgba(0,113,227,0.35)]"
                : "bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[#6e6e73] dark:text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-white"
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
