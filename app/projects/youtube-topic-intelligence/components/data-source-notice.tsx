import { FlaskConical, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

/** States where the numbers come from. On synthetic data this is not optional fine
 *  print: every finding on the page is a property of the simulated scenario. */
export function DataSourceNotice({ isSynthetic, className }: { isSynthetic: boolean; className?: string }) {
  if (!isSynthetic) {
    return (
      <p className={cn("inline-flex items-center gap-2 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6]", className)}>
        <Radio className="w-3.5 h-3.5 text-[#30d158]" aria-hidden />
        Live sample · YouTube Data API v3
      </p>
    );
  }
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-left",
        className,
      )}
    >
      <FlaskConical className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="text-[12.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7]">
        <span className="font-semibold">Synthetic benchmark dataset.</span>{" "}
        These figures come from a seeded simulation with the same schema as the YouTube Data API.
        They show that the method recovers planted effects, not that those effects exist on YouTube.
        Set <code className="font-mono text-[11.5px]">YOUTUBE_API_KEY</code> and re-run the pipeline to
        replace them with a live sample.
      </p>
    </div>
  );
}
