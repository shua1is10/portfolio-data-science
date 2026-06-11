import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FadeUp } from "@/components/ui/animate";

export const metadata: Metadata = {
  title: "Projects — Joshua Sánchez",
  description:
    "Featured AI and data science projects: dynamic pricing dashboards, social listening agents, and global attention span forecasting.",
};

/* ─────────────────────────────────────────────────────────────
   MOCKUP COMPONENTS
   These are pure visual placeholders that mimic real product UIs.
   Replace the inner content with <Image /> when screenshots are ready.
───────────────────────────────────────────────────────────── */

/** Fake pricing dashboard — chart + KPI cards */
function DashboardMockup() {
  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-[#141416] p-5 sm:p-7">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 mb-5 shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 h-5 w-40 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e]" />
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <p className="text-[10px] font-medium text-[#6e6e73] dark:text-[#8e8e93] uppercase tracking-[0.06em]">
            Avg. Market Price
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] dark:text-white mt-1 tracking-tight">
            $489.00
          </p>
        </div>
        <span className="mt-1 px-2.5 py-1 rounded-full bg-[#e8fbe8] dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-semibold">
          ↑ 12.4%
        </span>
      </div>

      {/* SVG line chart — grows to fill available space */}
      <div className="relative flex-1 min-h-0 mb-4">
        <svg
          className="w-full h-full"
          viewBox="0 0 440 110"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0071e3" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0071e3" stopOpacity="0"    />
            </linearGradient>
          </defs>
          {/* Horizontal grid lines */}
          {[22, 44, 66, 88].map((y) => (
            <line
              key={y}
              x1="0" y1={y} x2="440" y2={y}
              stroke="#6e6e73" strokeOpacity="0.07" strokeWidth="1"
            />
          ))}
          {/* Area fill */}
          <path
            d="M0,90 C40,84 80,70 120,58 C155,48 175,74 220,46 C258,28 288,55 330,26 C362,14 402,34 440,14 L440,110 L0,110 Z"
            fill="url(#priceFill)"
          />
          {/* Trend line */}
          <path
            d="M0,90 C40,84 80,70 120,58 C155,48 175,74 220,46 C258,28 288,55 330,26 C362,14 402,34 440,14"
            fill="none"
            stroke="#0071e3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Data-point dots */}
          {([[0,90],[120,58],[220,46],[330,26],[440,14]] as [number,number][]).map(([x,y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#0071e3" />
          ))}
        </svg>
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
        {(
          [
            { label: "Retailers",    value: "12",    sub: "tracked"  },
            { label: "ML Accuracy",  value: "94.2%", sub: "model"    },
            { label: "Weekly Δ",     value: "+8.3%", sub: "avg price" },
          ] as { label: string; value: string; sub: string }[]
        ).map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-2xl p-2.5 sm:p-3"
          >
            <p className="text-[9px] sm:text-[10px] font-medium text-[#6e6e73] dark:text-[#8e8e93] truncate">
              {label}
            </p>
            <p className="text-sm sm:text-base font-bold text-[#1d1d1f] dark:text-white mt-0.5">
              {value}
            </p>
            <p className="text-[9px] font-medium text-[#0071e3] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Web analytics mini-dashboard preview */
function WebAnalyticsMockup() {
  const METRICS = [
    { label: "Total Visitors", value: "24,513", delta: "+8.2%", up: true  },
    { label: "Conv. Rate",     value: "3.8%",   delta: "+1.1%", up: true  },
    { label: "Avg. Session",   value: "2m 34s", delta: "−0.3%", up: false },
  ];
  /* Deterministic bar heights (sessions trend) */
  const BARS = [40, 58, 47, 72, 62, 80, 55, 68, 76, 65, 82, 70];
  const SRCS = ["Organic", "Social", "CPC", "Direct"];

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-[#141416] p-5 sm:p-7">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 mb-4 shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 h-5 w-44 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e]" />
      </div>

      {/* 3 mini metric cards */}
      <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
        {METRICS.map((m) => (
          <div key={m.label} className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl p-2.5">
            <p className="text-[9px] text-[#6e6e73] dark:text-[#8e8e93] truncate">{m.label}</p>
            <p className="text-sm font-bold text-[#1d1d1f] dark:text-white mt-0.5 leading-tight">
              {m.value}
            </p>
            <p className={`text-[9px] font-semibold mt-0.5 ${m.up ? "text-[#30d158]" : "text-[#ff3b30]"}`}>
              {m.delta}
            </p>
          </div>
        ))}
      </div>

      {/* Sessions bar chart (SVG, no deps) */}
      <div className="flex-1 min-h-0 mb-3">
        <p className="text-[9px] font-medium text-[#6e6e73] dark:text-[#8e8e93] mb-1.5">
          Sessions · Last 12 weeks
        </p>
        <svg className="w-full h-full" viewBox="0 0 264 64" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="wabGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0071e3" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0071e3" stopOpacity="0.30" />
            </linearGradient>
          </defs>
          {/* Subtle baseline */}
          <line x1="0" y1="63" x2="264" y2="63" stroke="#e5e5ea" strokeWidth="0.6" />
          {BARS.map((h, i) => (
            <rect
              key={i}
              x={i * 22 + 1}
              y={64 - h * 0.78}
              width={19}
              height={h * 0.78}
              fill="url(#wabGrad)"
              rx="3"
            />
          ))}
        </svg>
      </div>

      {/* Traffic source chips */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {SRCS.map((s) => (
          <span
            key={s}
            className="px-2 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#3a3a3c] text-[9px] font-medium text-[#6e6e73] dark:text-[#8e8e93]"
          >
            {s}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded-full bg-[#0071e3]/10 text-[9px] font-medium text-[#0071e3]">
          +2 more
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FORECAST MOCKUP — Digital Addiction Case Study
───────────────────────────────────────────────────────────── */
function ForecastMockup() {
  const STATS = [
    { label: "Countries",     value: "100",    accent: "text-[#0071e3]" },
    { label: "Observations",  value: "60K+",   accent: "text-violet-500" },
    { label: "Year horizon",  value: "2060",   accent: "text-emerald-600" },
  ];

  const FINDINGS = [
    { label: "Platform engagement vs. Addiction Score", r: "r = +0.883", positive: true  },
    { label: "Platform engagement vs. Attention Span",  r: "r = −1.000", positive: false },
    { label: "Addiction Pressure vs. Sleep Quality",    r: "r = −0.301", positive: false },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-[#141416] p-5 sm:p-7">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 mb-5 shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 h-5 w-48 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e]" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <p className="text-[10px] font-medium text-[#6e6e73] dark:text-[#8e8e93] uppercase tracking-[0.06em]">
            Mean Focus Span · Global
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] dark:text-white mt-1 tracking-tight">
            18.0 min
          </p>
        </div>
        <span className="mt-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/25 text-amber-600 dark:text-amber-400 text-xs font-semibold">
          All ages ↔
        </span>
      </div>

      {/* Flat attention chart — illustrates the plateau */}
      <div className="relative flex-1 min-h-0 mb-3">
        <svg className="w-full h-full" viewBox="0 0 440 90" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="flatFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0071e3" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#0071e3" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[22, 44, 66].map((y) => (
            <line key={y} x1="0" y1={y} x2="440" y2={y}
              stroke="#6e6e73" strokeOpacity="0.07" strokeWidth="1" />
          ))}
          {/* Relatively flat line with slight downward trend */}
          <path
            d="M0,35 C55,34 110,36 165,35 C220,34 275,38 330,37 C375,37 412,39 440,41"
            fill="none" stroke="#0071e3" strokeWidth="2.5" strokeLinecap="round"
          />
          <path
            d="M0,35 C55,34 110,36 165,35 C220,34 275,38 330,37 C375,37 412,39 440,41 L440,90 L0,90 Z"
            fill="url(#flatFill)"
          />
          {/* Year labels */}
          {[["0","2015"],["220","2040"],["440","2060"]].map(([x, lbl]) => (
            <text key={lbl} x={Number(x) + (lbl==="2015" ? 4 : lbl==="2060" ? -36 : -14)}
              y="86" fontSize="8" fill="#6e6e73" fontFamily="sans-serif">{lbl}</text>
          ))}
        </svg>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 mb-3 shrink-0">
        {STATS.map(({ label, value, accent }) => (
          <div key={label} className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-2xl p-2.5 text-center">
            <p className={`text-sm sm:text-base font-bold ${accent}`}>{value}</p>
            <p className="text-[9px] text-[#6e6e73] dark:text-[#8e8e93] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Correlation findings */}
      <div className="space-y-1.5 shrink-0">
        {FINDINGS.map(({ label, r, positive }) => (
          <div key={label}
            className="flex items-center justify-between bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl px-3 py-2"
          >
            <p className="text-[10px] text-[#6e6e73] dark:text-[#8e8e93] truncate pr-2">{label}</p>
            <span className={`text-[10px] font-bold shrink-0 ${positive ? "text-[#0071e3]" : "text-rose-500"}`}>
              {r}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PREDICTIVE ENGINE MOCKUP — International Football Forecasting
───────────────────────────────────────────────────────────── */
function PredictiveEngineMockup() {
  /* Opening-round projections produced by the live engine (official fixtures) */
  const MATCHES = [
    { a: "Mexico",  b: "South Africa", pA: 62, pD: 29, pB: 9  },
    { a: "Spain",   b: "Cape Verde",   pA: 46, pD: 33, pB: 21 },
    { a: "England", b: "Croatia",      pA: 67, pD: 25, pB: 8  },
  ];
  const FORM = [
    { team: "Spain",      delta: "+45.1%", up: true  },
    { team: "France",     delta: "+44.4%", up: true  },
    { team: "Uzbekistan", delta: "−14.0%", up: false },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-[#141416] p-5 sm:p-7">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 mb-4 shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 h-5 w-44 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e]" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <p className="text-[10px] font-medium text-[#6e6e73] dark:text-[#8e8e93] uppercase tracking-[0.06em]">
            Opening Round Projections · Market-Calibrated
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] dark:text-white mt-1 tracking-tight">
            24 fixtures priced
          </p>
        </div>
        <span className="mt-1 px-2.5 py-1 rounded-full bg-[#e8fbe8] dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-semibold">
          ● Projections live
        </span>
      </div>

      {/* Match probability bars */}
      <div className="flex-1 min-h-0 space-y-2.5 mb-4">
        {MATCHES.map(({ a, b, pA, pD, pB }) => (
          <div key={a} className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-2xl p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                {a} <span className="text-[#86868b] font-normal">vs</span> {b}
              </p>
              <p className="text-[9px] font-bold text-[#0071e3] shrink-0 ml-2">{pA}% · {pD}% · {pB}%</p>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              <span className="bg-[#0071e3]" style={{ width: `${pA}%` }} />
              <span className="bg-[#aeaeb2] dark:bg-[#636366]" style={{ width: `${pD}%` }} />
              <span className="bg-[#5ac8fa]" style={{ width: `${pB}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic form chips */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {FORM.map(({ team, delta, up }) => (
          <span
            key={team}
            className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
              up
                ? "bg-[#e8fbe8] dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-[#ffeceb] dark:bg-red-900/25 text-[#ff3b30] dark:text-red-400"
            }`}
          >
            {team} {delta}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded-full bg-[#0071e3]/10 text-[9px] font-medium text-[#0071e3]">
          Dynamic Form Index
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   APPLE-STYLE PROJECT CARD
───────────────────────────────────────────────────────────── */
interface ProjectCardProps {
  eyebrow:       string;
  title:         string;
  subtitle:      string;
  cta:           string;
  href:          string;
  /** Optional second pill button — renders with border/transparent style */
  ctaSecondary?: string;
  hrefSecondary?: string;
  /** Optional technology tags rendered as pills under the subtitle */
  tags?:         string[];
  mockup:        React.ReactNode;
  delay?:        number;
}

function ProjectCard({
  eyebrow, title, subtitle, cta, href,
  ctaSecondary, hrefSecondary, tags,
  mockup, delay = 0,
}: ProjectCardProps) {
  return (
    <FadeUp delay={delay}>
      <article className="w-full rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] overflow-hidden">

        {/* ── Text section (centered, Apple-style) ── */}
        <div className="text-center pt-14 pb-10 px-6 sm:px-12 max-w-2xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
            {eyebrow}
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.8vw,2.875rem)] font-bold tracking-[-0.035em] leading-tight text-[#1d1d1f] dark:text-white">
            {title}
          </h2>
          <p className="mt-4 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
            {subtitle}
          </p>

          {/* Technology tags */}
          {tags && tags.length > 0 && (
            <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-white dark:bg-[#2c2c2e] border border-[#1d1d1f]/8 dark:border-white/10 text-[11px] font-medium text-[#515154] dark:text-[#a1a1a6]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA buttons — pill-shaped, Apple Blue */}
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            {/* Primary: solid blue */}
            <Link
              href={href}
              className="px-6 py-2.5 rounded-full bg-[#0071e3] text-white text-sm font-medium transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_0_22px_rgba(0,113,227,0.38)] active:scale-[0.97] no-underline"
            >
              {cta}
            </Link>

            {/* Secondary: transparent + border (when provided) OR text link */}
            {ctaSecondary && hrefSecondary ? (
              <Link
                href={hrefSecondary}
                className="px-6 py-2.5 rounded-full border border-[#0071e3]/30 text-[#0071e3] text-sm font-medium transition-all duration-200 hover:border-[#0071e3]/60 hover:bg-[#0071e3]/5 active:scale-[0.97] no-underline"
              >
                {ctaSecondary}
              </Link>
            ) : (
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-[#0071e3] text-sm font-medium hover:underline no-underline transition-all duration-150"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5 mt-px" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Visual / mockup area ── */}
        <div className="relative mx-6 sm:mx-10 overflow-hidden rounded-t-3xl h-[340px] sm:h-[380px] shadow-[0_-6px_48px_rgba(0,0,0,0.08)] dark:shadow-[0_-6px_48px_rgba(0,0,0,0.28)]">
          {mockup}
        </div>

      </article>
    </FadeUp>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export default function ProjectsPage() {
  return (
    <>
      {/* ── Minimal hero ───────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <FadeUp>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
              Selected work
            </p>
          </FadeUp>
          <FadeUp delay={0.07}>
            <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] font-bold tracking-[-0.04em] leading-[1.03] text-[#1d1d1f] dark:text-white">
              Featured Projects
            </h1>
          </FadeUp>
          <FadeUp delay={0.13}>
            <p className="text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed max-w-[480px] mx-auto">
              Applying predictive models and AI automation to real-world
              challenges — from pricing intelligence to multi-platform
              social monitoring.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ── Project cards — full-width, stacked ────────────── */}
      <section className="px-4 sm:px-6 pb-28">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">

          <ProjectCard
            eyebrow="Featured Project · Machine Learning"
            title="International Football Predictive Engine"
            subtitle="An advanced machine learning pipeline and dynamic ELO tracking system forecasting the ultimate global football tournament, built resiliently from limited data."
            tags={[
              "Python", "scikit-learn", "pandas",
              "Multinomial Logistic Regression", "Dynamic ELO",
              "Next.js", "TypeScript", "Recharts",
            ]}
            cta="Explore Dashboard"
            href="/projects/football-predictive-engine/dashboard"
            ctaSecondary="Read Case Study"
            hrefSecondary="/projects/football-predictive-engine"
            mockup={<PredictiveEngineMockup />}
            delay={0}
          />

          <ProjectCard
            eyebrow="Predictive Analytics"
            title="Dynamic Pricing Dashboard"
            subtitle="Advanced time-series forecasting to surface actionable pricing intelligence."
            cta="Explore Dashboard"
            href="/projects/dynamic-pricing"
            mockup={<DashboardMockup />}
            delay={0}
          />

          <ProjectCard
            eyebrow="Data Analytics"
            title="Web Analytics & Behavior Dashboard"
            subtitle="Advanced user tracking and conversion optimization platform leveraging data-driven insights."
            cta="View Project Details"
            href="/projects/web-analytics"
            mockup={<WebAnalyticsMockup />}
            delay={0.1}
          />

          <ProjectCard
            eyebrow="Data Science · ML Research"
            title="Global Attention Span Forecasting"
            subtitle="Time-series predictive modeling of global short-form content addiction and mental well-being from 2015 to 2060."
            cta="Read Case Study"
            href="/projects/digital-addiction-forecasting"
            ctaSecondary="Explore Dashboard"
            hrefSecondary="#"
            mockup={<ForecastMockup />}
            delay={0.18}
          />

          {/* Placeholder for future projects */}
          <FadeUp delay={0.26}>
            <div className="w-full rounded-[2.5rem] border-2 border-dashed border-[#d2d2d7] dark:border-[#3a3a3c] h-24 flex items-center justify-center">
              <p className="text-sm font-medium text-[#6e6e73] dark:text-[#8e8e93]">
                More projects coming soon
              </p>
            </div>
          </FadeUp>

        </div>
      </section>
    </>
  );
}
