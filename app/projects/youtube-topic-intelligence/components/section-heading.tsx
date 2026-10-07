import { cn } from "@/lib/utils";

/** Eyebrow + title + lede, matching the other case studies' section rhythm. */
export function SectionHeading({
  eyebrow, title, children, className, tone = "light",
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn("text-center max-w-2xl mx-auto mb-12", className)}>
      <p className={cn(
        "text-[11px] font-bold uppercase tracking-[0.1em]",
        tone === "dark" ? "text-[#66b2ff]" : "text-[#0071e3]",
      )}>
        {eyebrow}
      </p>
      <h2 className={cn(
        "mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold tracking-[-0.03em]",
        tone === "dark" ? "text-white" : "text-[#1d1d1f] dark:text-white",
      )}>
        {title}
      </h2>
      {children && (
        <p className={cn(
          "mt-4 text-[1.0625rem] leading-relaxed",
          tone === "dark" ? "text-[#a1a1a6]" : "text-[#6e6e73] dark:text-[#a1a1a6]",
        )}>
          {children}
        </p>
      )}
    </div>
  );
}
