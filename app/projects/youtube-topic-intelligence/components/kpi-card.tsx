import type { LucideIcon } from "lucide-react";

/** Scorecard tile: one headline number, its definition, and optional context.
 *  Deliberately no colored delta — direction is stated in words in `sub`. */
export function KpiCard({ icon: Icon, label, value, sub, note }: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="h-full rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-5 sm:p-6 flex flex-col">
      <span className="w-9 h-9 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#0071e3]" aria-hidden />
      </span>
      <p className="mt-4 text-[clamp(1.5rem,2.8vw,2rem)] font-bold tracking-[-0.04em] leading-none tabular-nums text-[#1d1d1f] dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-white">{label}</p>
      {sub && <p className="mt-0.5 text-[12px] text-[#6e6e73] dark:text-[#a1a1a6] leading-snug">{sub}</p>}
      {note && <p className="mt-auto pt-3 text-[10.5px] leading-snug text-[#86868b]">{note}</p>}
    </div>
  );
}
