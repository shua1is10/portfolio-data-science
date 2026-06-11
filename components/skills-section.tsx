"use client";

import { Database, Bot, Workflow, LineChart, Code } from "lucide-react";
import { RadialOrbitalTimeline } from "@/components/ui/radial-orbital-timeline";
import type { TimelineItem } from "@/components/ui/radial-orbital-timeline";

const timelineData: TimelineItem[] = [
  {
    id: 1,
    title: "Data Science & Python",
    date: "Core",
    content:
      "Advanced data processing, statistical analysis, and machine learning models using Python.",
    category: "Data",
    icon: Database,
    relatedIds: [2, 4],
    status: "completed",
    energy: 100,
  },
  {
    id: 2,
    title: "AI Agents Integration",
    date: "Specialized",
    content:
      "Developing intelligent agents using Claude and other LLMs for automated reasoning and natural language processing.",
    category: "AI",
    icon: Bot,
    relatedIds: [1, 3],
    status: "completed",
    energy: 90,
  },
  {
    id: 3,
    title: "Workflow Automation",
    date: "Infrastructure",
    content:
      "Architecting robust automation pipelines using n8n to connect APIs and streamline business operations.",
    category: "Engineering",
    icon: Workflow,
    relatedIds: [2],
    status: "completed",
    energy: 85,
  },
  {
    id: 4,
    title: "Time Series & Forecasting",
    date: "Predictive",
    content:
      "Dynamic pricing models and advanced forecasting algorithms for business intelligence.",
    category: "Analytics",
    icon: LineChart,
    relatedIds: [1, 5],
    status: "completed",
    energy: 95,
  },
  {
    id: 5,
    title: "Full-Stack & Dashboards",
    date: "Visualization",
    content:
      "Building interactive, liquid-glass styled web applications to visualize complex data models.",
    category: "Development",
    icon: Code,
    relatedIds: [4, 3],
    status: "in-progress",
    energy: 70,
  },
];

export function SkillsSection() {
  return (
    <section
      id="skills"
      className="relative py-28 px-6 bg-secondary/40 overflow-hidden"
    >
      {/* Section ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[2px] opacity-60"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,122,255,0.25), transparent)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Technical expertise
          </p>
          <h2 className="text-[clamp(1.8rem,4.5vw,3rem)] font-bold tracking-[-0.03em] leading-tight text-foreground">
            Skills & Stack
          </h2>
          <p className="text-muted-foreground text-[1.0625rem] max-w-[460px] mx-auto leading-relaxed">
            Click any node to explore connections and proficiency across my
            core disciplines.
          </p>
        </div>

        {/* Orbital Timeline */}
        <RadialOrbitalTimeline timelineData={timelineData} />
      </div>
    </section>
  );
}
