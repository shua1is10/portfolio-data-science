import type { Highlight } from "../types";
import { MicroBars } from "./micro-bars";
import { PeriodLegend } from "./period-legend";

/** Executive highlight: kicker → data-derived headline → micro chart → evidence line.
 *  Every string comes from the pipeline, so the copy can never drift from the numbers. */
export function HighlightCard({ highlight, prevLabel, currLabel }: {
  highlight: Highlight;
  prevLabel: string;
  currLabel: string;
}) {
  return (
    <article className="h-full flex flex-col rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-6 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0071e3]">
        {highlight.kicker}
      </p>
      <h3 className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-[#1d1d1f] dark:text-white">
        {highlight.headline}
      </h3>
      <div className="mt-5 text-[#1d1d1f] dark:text-[#f5f5f7]">
        <MicroBars bars={highlight.bars} unit={highlight.unit} />
        <PeriodLegend prevLabel={prevLabel} currLabel={currLabel} className="mt-2" />
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-[#6e6e73] dark:text-[#a1a1a6]">
        {highlight.detail}
      </p>
      <p className="mt-auto pt-4 font-mono text-[10.5px] leading-relaxed text-[#86868b] dark:text-[#8e8e93]">
        {highlight.evidence}
      </p>
    </article>
  );
}
