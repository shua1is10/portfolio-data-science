import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prominent "Powered by Generative AI Insights" badge.
 * Dark AI-tech pill wrapped in an animated flowing-gradient ring with a
 * pulsing outer glow — designed to read as frontier tooling at a glance.
 * Pure CSS (tailwind `gradient-flow` / `orbital-pulse` keyframes), so it
 * stays server-renderable.
 */
export function GenAIBadge({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex rounded-full p-[1.5px]", className)}>
      {/* Pulsing outer glow */}
      <span
        aria-hidden
        className="absolute -inset-1.5 rounded-full bg-[linear-gradient(110deg,#a855f7,#0071e3,#5ac8fa)] opacity-30 blur-lg animate-orbital-pulse"
      />
      {/* Animated gradient ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[linear-gradient(110deg,#a855f7,#0071e3,#5ac8fa,#a855f7)] bg-200% animate-gradient-flow"
      />
      {/* Dark core pill */}
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full bg-[#0a0a0f] font-semibold text-white",
          size === "sm"
            ? "px-3 py-1 text-[10px]"
            : "px-4 py-1.5 text-[11px] tracking-wide"
        )}
      >
        <Sparkles
          className={cn(
            "text-violet-400",
            size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"
          )}
        />
        Powered by Generative AI Insights
      </span>
    </span>
  );
}
