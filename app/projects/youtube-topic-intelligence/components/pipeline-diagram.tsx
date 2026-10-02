import { ChevronRight, Database, Eraser, Sigma, MessageSquareText, FlaskConical, Share2 } from "lucide-react";

const NODES = [
  { icon: Database, label: "Ingestion", sub: "API v3 · month × query strata", mono: "search → videos → comments", tint: "#ff9f0a" },
  { icon: Eraser, label: "Cleaning", sub: "language · spam · astroturfing", mono: "likes=None ≠ 0", tint: "#ff6961" },
  { icon: Sigma, label: "Features", sub: "age-normalized metrics", mono: "velocity · engagement · RVI", tint: "#0071e3" },
  { icon: MessageSquareText, label: "NLP", sub: "sentiment · topics · terms", mono: "VADER + log-odds", tint: "#a855f7" },
  { icon: FlaskConical, label: "Inference", sub: "non-parametric tests", mono: "bootstrap · MWU · BH-FDR", tint: "#30d158" },
  { icon: Share2, label: "Export", sub: "typed JSON contracts", mono: "data/ · public/data/", tint: "#5ac8fa" },
];

/** Conceptual pipeline diagram — pure Tailwind, server-rendered, same blueprint
 *  aesthetic as the football engine's architecture panel. */
export function PipelineDiagram({ records, comments, quota }: { records: number; comments: number; quota: number }) {
  return (
    <div className="relative rounded-[28px] bg-[#0a0a0f] border border-white/10 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,113,227,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,113,227,0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white">Data pipeline</p>
          <p className="font-mono text-[10px] text-[#8e8e93]">
            // {records.toLocaleString("en-US")} videos · {comments.toLocaleString("en-US")} comments scored · {quota.toLocaleString("en-US")} API quota units
          </p>
        </div>
        <ol className="flex flex-col lg:flex-row items-stretch lg:items-center gap-1 lg:gap-1.5">
          {NODES.map(({ icon: Icon, label, sub, mono, tint }, i) => (
            <li key={label} className="contents">
              {i > 0 && (
                <ChevronRight aria-hidden className="w-4 h-4 shrink-0 self-center rotate-90 lg:rotate-0 text-[#0071e3]" />
              )}
              <div className="flex-1 min-w-0 rounded-2xl bg-white/[0.045] border border-white/10 px-3 py-4 text-center">
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5"
                  style={{ background: `${tint}1f` }}
                >
                  <Icon className="w-[18px] h-[18px]" style={{ color: tint }} aria-hidden />
                </span>
                <p className="text-[12.5px] font-semibold text-white">{label}</p>
                <p className="mt-1 text-[10.5px] text-[#8e8e93] leading-snug">{sub}</p>
                <p className="mt-2 font-mono text-[9.5px] leading-snug" style={{ color: tint }}>{mono}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
