import type { Metadata } from "next";
import { Bot, Workflow, LineChart, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PageTransition,
  FadeUp,
  StaggerGrid,
  StaggerItem,
  MotionCard,
} from "@/components/ui/animate";

export const metadata: Metadata = {
  title: "Services — Joshua Sánchez",
  description:
    "AI agents, workflow automation, and predictive analytics services. Specialized solutions to scale your operations through data and intelligent systems.",
};

/* ── Service definitions ───────────────────────────────── */
const SERVICES = [
  {
    icon:        Bot,
    label:       "AI Engineering",
    title:       "AI Agents Integration",
    description:
      "Design and deployment of autonomous agents using advanced LLMs (like Claude) for complex reasoning and natural language tasks.",
    features: [
      "Autonomous multi-step reasoning",
      "LLM-powered decision systems",
      "Multi-agent orchestration",
    ],
    iconColor: "text-blue-500",
    iconBg:    "bg-blue-500/10 border-blue-400/20",
    glow:      "group-hover:shadow-[0_0_30px_rgba(0,122,255,0.10)]",
    border:    "group-hover:border-blue-400/30",
  },
  {
    icon:        Workflow,
    label:       "Process Engineering",
    title:       "Workflow Automation",
    description:
      "Architecting robust, multi-step automation pipelines using n8n and APIs to eliminate manual bottlenecks in business operations.",
    features: [
      "n8n pipeline architecture",
      "API integrations & webhooks",
      "End-to-end error monitoring",
    ],
    iconColor: "text-cyan-500",
    iconBg:    "bg-cyan-500/10 border-cyan-400/20",
    glow:      "group-hover:shadow-[0_0_30px_rgba(6,182,212,0.10)]",
    border:    "group-hover:border-cyan-400/30",
  },
  {
    icon:        LineChart,
    label:       "Predictive Analytics",
    title:       "Predictive Analytics & Time Series",
    description:
      "Development of advanced forecasting algorithms and dynamic models to predict trends and drive proactive business decisions.",
    features: [
      "Time series forecasting",
      "Dynamic pricing models",
      "BI dashboards & reporting",
    ],
    iconColor: "text-emerald-500",
    iconBg:    "bg-emerald-500/10 border-emerald-400/20",
    glow:      "group-hover:shadow-[0_0_30px_rgba(16,185,129,0.10)]",
    border:    "group-hover:border-emerald-400/30",
  },
] as const;

/* ── Page ──────────────────────────────────────────────── */
export default function ServicesPage() {
  return (
    <PageTransition>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative py-28 px-6 text-center overflow-hidden">
        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px]"
            style={{
              background:
                "radial-gradient(ellipse at center top, rgba(0,122,255,0.07) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto space-y-5">
          <FadeUp>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-blue text-primary text-xs font-bold uppercase tracking-[0.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-orbital-pulse" />
              What I offer
            </span>
          </FadeUp>

          <FadeUp delay={0.08}>
            <h1 className="text-[clamp(2.2rem,5.5vw,4rem)] font-bold tracking-[-0.04em] leading-[1.04] text-foreground">
              Specialized{" "}
              <span className="text-gradient-blue">AI Services</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.14}>
            <p className="text-[1.0625rem] text-muted-foreground leading-relaxed max-w-[500px] mx-auto">
              Scale your operations with data-driven intelligence. From autonomous
              AI agents to end-to-end predictive pipelines — purpose-built for
              real business outcomes.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ── Services grid ────────────────────────────────── */}
      <section className="px-6 pb-28">
        <div className="max-w-6xl mx-auto">
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SERVICES.map((svc) => (
              <StaggerItem key={svc.title}>
                <MotionCard
                  className={cn(
                    "group h-full rounded-[28px]",
                    "glass border border-foreground/8",
                    "p-8 flex flex-col gap-7",
                    "transition-all duration-300",
                    svc.glow,
                    svc.border
                  )}
                >
                  {/* Icon + label */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border",
                        svc.iconBg
                      )}
                    >
                      <svc.icon className={cn("w-5 h-5", svc.iconColor)} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                      {svc.label}
                    </span>
                  </div>

                  {/* Text */}
                  <div className="space-y-3 flex-1">
                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground leading-snug">
                      {svc.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2.5">
                    {svc.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check
                          className={cn("w-3.5 h-3.5 shrink-0", svc.iconColor)}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </MotionCard>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── CTA strip ────────────────────────────────────── */}
      <section className="px-6 pb-28">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div
              className={cn(
                "rounded-[32px] glass border border-foreground/8",
                "p-10 sm:p-14 flex flex-col sm:flex-row items-center justify-between gap-8"
              )}
            >
              <div className="space-y-2 text-center sm:text-left">
                <h3 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
                  Ready to get started?
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Tell me about your challenge and we&apos;ll figure out the
                  best AI-powered approach together.
                </p>
              </div>
              <a
                href="mailto:joshuaisan17o@gmail.com"
                className={cn(
                  "inline-flex items-center gap-2 shrink-0",
                  "px-7 py-3.5 rounded-full",
                  "bg-primary text-white text-sm font-semibold",
                  "transition-all duration-200",
                  "hover:shadow-[0_0_24px_rgba(0,122,255,0.40)] hover:-translate-y-px",
                  "active:scale-95"
                )}
              >
                Let&apos;s Talk
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </FadeUp>
        </div>
      </section>
    </PageTransition>
  );
}
