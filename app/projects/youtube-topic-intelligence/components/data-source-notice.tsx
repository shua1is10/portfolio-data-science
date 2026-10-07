import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtNum } from "./format";

/** Provenance line: where the numbers come from and how big the sample is. */
export function DataSourceNotice({ fetchedAt, videos, comments, className }: {
  fetchedAt: string;
  videos: number;
  comments: number;
  className?: string;
}) {
  return (
    <p className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]", className)}>
      <Radio className="w-3.5 h-3.5 text-[#30d158]" aria-hidden />
      <span>Live sample · YouTube Data API v3</span>
      <span aria-hidden>·</span>
      <span>{fmtNum(videos)} videos · {fmtNum(comments)} organic comments</span>
      <span aria-hidden>·</span>
      <span>collected {fmtDate(fetchedAt.slice(0, 10))}</span>
    </p>
  );
}
