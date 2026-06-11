import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Database, Cpu, TrendingUp,
  ShieldCheck, GitBranch, Scale, Lock, Sparkles,
  BrainCircuit, FileText, Bot, Braces, Target, ChevronRight,
} from "lucide-react";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";
import { GenAIBadge } from "@/components/ui/genai-badge";

export const metadata: Metadata = {
  title: "International Football Predictive Engine — Joshua Sánchez",
  description:
    "Case study: an ML pipeline and dynamic ELO tracking system forecasting the ultimate global football tournament — calibrated probabilities, proxy feature engineering, and a live form index that evolves without retraining.",
};

/* ─────────────────────────────────────────────────────────────
   STATIC CONTENT — real metrics from the trained engine
───────────────────────────────────────────────────────────── */
const METRICS = [
  {
    label: "Model Accuracy",
    value: "42.0%",
    sub: "5-fold CV · 3-class (random = 33.3%)",
    accent: "text-[#0071e3]",
  },
  {
    label: "Log-Loss vs Baseline",
    value: "1.038",
    sub: "beats the 1.098 class-frequency baseline",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Training Match-Ups",
    value: "214",
    sub: "reconstructed from raw team logs",
    accent: "text-violet-600 dark:text-violet-400",
  },
  {
    label: "Teams Tracked",
    value: "48",
    sub: "across 12 groups · live form index",
    accent: "text-amber-600 dark:text-amber-400",
  },
];

const PIPELINE_STEPS = [
  {
    icon: Database,
    title: "Match-Up Feature Engineering",
    body: "825 raw per-team match logs are collapsed into team profiles, then transformed into a relational 'Team A vs Team B' format. Every feature is a Delta — expected-goals difference, possession gap, betting-market implied probability spread, and historical pedigree (titles, finals, semifinals) — so the model learns relative strength, not team identity.",
  },
  {
    icon: Cpu,
    title: "Calibrated Probabilistic Model",
    body: "A multinomial Logistic Regression (impute → standardize → L2-regularized classifier) outputs true mathematical probabilities for Win A / Draw / Win B. It optimizes log-loss directly, so a 60% forecast genuinely means 60% — verified against a class-frequency baseline under stratified cross-validation.",
  },
  {
    icon: GitBranch,
    title: "Train Once, Never Retrain",
    body: "The model is fitted a single time and persisted to disk. During the tournament it is never re-fitted — a deliberate guardrail against overfitting to tiny in-tournament samples. Adaptivity comes from a separate, transparent layer: the Live Form Index.",
  },
  {
    icon: TrendingUp,
    title: "Live Form Index (Dynamic ELO)",
    body: "After each real result, every team's multiplicative form index is updated Bayesian-style: the boost scales with the surprise (1 − predicted probability of the observed outcome), is amplified by goal margin, and corrected by the match's real expected-goals balance. Next-round predictions tilt the base probabilities by the form ratio — so forecasts evolve organically with the tournament.",
  },
];

const HYBRID_STEPS = [
  {
    icon: Bot,
    title: "LLM-Powered Agentic Workflows",
    body: "Post-match intelligence does not arrive as clean tabular data — it arrives as unstructured match PDFs and anti-bot-walled results pages. An autonomous extraction agent orchestrates the run end-to-end: it drives a real browser, plans its own parsing strategy, self-corrects on malformed documents, and retries failed extractions. No brittle CSS selectors, no regex archaeology — the LLM reasons over each document the way a human analyst would.",
  },
  {
    icon: FileText,
    title: "NLP for Unstructured Data",
    body: "Natural Language Processing (NLP) for unstructured data is the hard engineering problem here: a single match report mixes free-flowing narrative prose with embedded hard metrics. The generative layer performs layout-aware reading, entity resolution, and unit normalization to extract both the qualitative context (how the match actually unfolded) and the quantitative telemetry (xG, possession, duel percentages) from the same raw document.",
  },
  {
    icon: Braces,
    title: "Generative AI Telemetry Parsing",
    body: "Every extraction is distilled into a strict, machine-validated JSON contract (ai_match_insights.json) — the boundary where probabilistic generation meets deterministic engineering. Each field is optional by design: the dashboard renders graceful pending states for unprocessed fixtures, so a parsing failure degrades the experience instead of breaking it. The parsed expected-goals balance then flows straight into the surprise-weighted Bayesian form update.",
  },
  {
    icon: BrainCircuit,
    title: "The Hybrid Verdict",
    body: "The final synthesis is where the Hybrid Intelligence Architecture earns its name: the generative layer reads the statistical model's pre-match probability distribution alongside the extracted telemetry and writes an analyst-grade verdict — did the model genuinely miss, or did variance simply win the day? Quantitative calibration and qualitative reasoning, reconciled in a single loop.",
  },
];

/* ── Hybrid AI Pipeline — architecture diagram nodes ─────────── */
const PIPELINE_NODES = [
  {
    icon: FileText,
    label: "Unstructured Match PDF",
    sub: "raw post-match reports",
    mono: "input: *.pdf",
    tint: "#ff9f0a",
  },
  {
    icon: Bot,
    label: "LLM / NLP Extraction Agent",
    sub: "agentic parsing loop",
    mono: "agent.extract()",
    tint: "#a855f7",
  },
  {
    icon: Braces,
    label: "Data Normalization",
    sub: "strict JSON contract",
    mono: "ai_match_insights.json",
    tint: "#0071e3",
  },
  {
    icon: TrendingUp,
    label: "Dynamic Bayesian ELO Update",
    sub: "surprise-weighted posterior",
    mono: "form ×= f(surprise, ΔxG)",
    tint: "#30d158",
  },
  {
    icon: Target,
    label: "Predictive Engine Forecast",
    sub: "form-tilted probabilities",
    mono: "P(win · draw · win)",
    tint: "#5ac8fa",
  },
];

/** Animated flow connector between pipeline stages (rotates to point
 *  downward when the diagram stacks vertically on small screens). */
function FlowConnector() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center shrink-0 rotate-90 lg:rotate-0 py-1 lg:py-0"
    >
      {[0, 1, 2].map((i) => (
        <ChevronRight
          key={i}
          className="w-4 h-4 -ml-2 first:ml-0 text-[#0071e3]"
          style={{ animation: `orbital-pulse 1.6s ease-in-out ${i * 0.22}s infinite` }}
        />
      ))}
    </div>
  );
}

/** Hybrid AI Pipeline architecture visualization — pure Tailwind/CSS,
 *  server-rendered, dark AI-tech aesthetic with a subtle blueprint grid. */
function HybridPipelineDiagram() {
  return (
    <div className="relative rounded-[28px] bg-[#0a0a0f] border border-white/10 overflow-hidden">
      {/* Blueprint grid backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,113,227,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,113,227,0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(168,85,247,0.16), transparent), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,113,227,0.14), transparent)",
        }}
      />

      <div className="relative p-6 sm:p-8">
        {/* Panel header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#30d158] animate-orbital-pulse" />
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white">
              Hybrid AI Pipeline
            </p>
          </div>
          <p className="font-mono text-[10px] text-[#8e8e93]">
            // agentic_workflow · 5 stages · zero retraining
          </p>
        </div>

        {/* Flow: stacked on mobile, left-to-right on desktop */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-1 lg:gap-2">
          {PIPELINE_NODES.map(({ icon: Icon, label, sub, mono, tint }, i) => (
            <div key={label} className="contents">
              {i > 0 && <FlowConnector />}
              <div className="flex-1 min-w-0 rounded-2xl bg-white/[0.045] border border-white/10 px-4 py-5 text-center transition-colors duration-200 hover:border-white/25">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3"
                  style={{ background: `${tint}1f`, boxShadow: `0 0 18px ${tint}26` }}
                >
                  <Icon className="w-5 h-5" style={{ color: tint }} />
                </span>
                <p className="text-[12.5px] font-semibold text-white leading-snug">
                  {label}
                </p>
                <p className="mt-1 text-[10.5px] text-[#8e8e93]">{sub}</p>
                <p className="mt-2 font-mono text-[9.5px]" style={{ color: tint }}>
                  {mono}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SCARCITY_POINTS = [
  {
    title: "Empty xG telemetry → goal-based proxies",
    body: "The scraped dataset arrived with the expected-goals columns 100% empty. Rather than discarding the feature, the pipeline substitutes a defensible proxy — average goals scored and conceded — and is wired to automatically prefer real xG the moment the scraper backfills it.",
  },
  {
    title: "Sparse possession data → mean imputation",
    body: "Possession was available for only ~40% of matches. A SimpleImputer inside the model pipeline handles missing values statistically instead of dropping rows, preserving every one of the scarce training examples.",
  },
  {
    title: "No head-to-head history → symmetric augmentation",
    body: "Only 214 matches existed between qualified teams. Each match is encoded from both perspectives (A vs B and B vs A with mirrored deltas), keeping the model order-invariant and squeezing maximum signal from minimum data.",
  },
];

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export default function PredictiveEngineCaseStudy() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-16 sm:pt-24 pb-14 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <FadeUp>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071e3] hover:underline no-underline"
            >
              <ArrowLeft className="w-4 h-4" /> All projects
            </Link>
          </FadeUp>
          <FadeUp delay={0.05}>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
              Case Study · Machine Learning · Sports Analytics
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="text-[clamp(2.2rem,5.5vw,3.75rem)] font-bold tracking-[-0.04em] leading-[1.05] text-[#1d1d1f] dark:text-white">
              International Football
              <br />
              Predictive Engine
            </h1>
          </FadeUp>
          <FadeUp delay={0.16}>
            <p className="text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed max-w-[560px] mx-auto">
              An advanced machine learning pipeline and dynamic ELO tracking
              system forecasting the ultimate global football tournament,
              built resiliently from limited data.
            </p>
          </FadeUp>
          <FadeUp delay={0.22}>
            <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
              <Link
                href="/projects/football-predictive-engine/dashboard"
                className="px-6 py-2.5 rounded-full bg-[#0071e3] text-white text-sm font-medium transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_0_22px_rgba(0,113,227,0.38)] active:scale-[0.97] no-underline"
              >
                Explore Dashboard
              </Link>
              <a
                href="#compliance"
                className="px-6 py-2.5 rounded-full border border-[#0071e3]/30 text-[#0071e3] text-sm font-medium transition-all duration-200 hover:border-[#0071e3]/60 hover:bg-[#0071e3]/5 active:scale-[0.97] no-underline"
              >
                IP Integrity Statement
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Metric cards ──────────────────────────────────── */}
      <section className="px-6 pb-20">
        <StaggerGrid className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map(({ label, value, sub, accent }) => (
            <StaggerItem key={label}>
              <div className="h-full rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6e6e73] dark:text-[#8e8e93]">
                  {label}
                </p>
                <p className={`mt-3 text-3xl sm:text-4xl font-bold tracking-tight ${accent}`}>
                  {value}
                </p>
                <p className="mt-2 text-xs text-[#86868b] dark:text-[#8e8e93] leading-relaxed">
                  {sub}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>
        <FadeUp delay={0.1}>
          <p className="max-w-2xl mx-auto mt-6 text-center text-xs text-[#86868b] dark:text-[#8e8e93] leading-relaxed">
            Honest numbers, on purpose: 3-way football outcomes are noisy and
            draws are structurally hard. What matters for a betting-grade
            forecaster is calibration — beating the log-loss baseline — not a
            vanity accuracy figure.
          </p>
        </FadeUp>
      </section>

      {/* ── The challenge: data scarcity ──────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-6 sm:px-12 py-14">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
                The Challenge
              </p>
              <h2 className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
                Forecasting with almost no data
              </h2>
              <p className="mt-4 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                National teams play a handful of matches per year, advanced
                telemetry was missing, and anti-bot infrastructure limited
                scraping depth. The engine was designed around scarcity rather
                than wishing it away.
              </p>
            </div>
          </FadeUp>
          <StaggerGrid className="grid md:grid-cols-3 gap-4">
            {SCARCITY_POINTS.map(({ title, body }) => (
              <StaggerItem key={title}>
                <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <Sparkles className="w-5 h-5 text-[#0071e3] mb-4" />
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white leading-snug">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                    {body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── System architecture / pipeline ────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
                System Design
              </p>
              <h2 className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
                A static brain with a living pulse
              </h2>
              <p className="mt-4 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                The core insight: separate what should be stable (the trained
                model) from what should adapt (team form). Each layer does one
                job and does it transparently.
              </p>
            </div>
          </FadeUp>
          <StaggerGrid className="grid sm:grid-cols-2 gap-4">
            {PIPELINE_STEPS.map(({ icon: Icon, title, body }, i) => (
              <StaggerItem key={title}>
                <div className="h-full rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-[#0071e3]/10">
                      <Icon className="w-[18px] h-[18px] text-[#0071e3]" />
                    </span>
                    <span className="text-[11px] font-bold text-[#86868b] dark:text-[#8e8e93]">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                    {body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── Live Form Index — how the update works ─────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto rounded-[2.5rem] bg-[#0a0a0f] dark:bg-[#1d1d1f] px-6 sm:px-12 py-14 overflow-hidden relative">
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,113,227,0.25), transparent)",
            }}
          />
          <FadeUp>
            <div className="relative text-center max-w-2xl mx-auto mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#66b2ff]">
                The Adaptive Layer
              </p>
              <h2 className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold tracking-[-0.03em] text-white">
                How the Live Form Index thinks
              </h2>
              <p className="mt-4 text-[1.0625rem] text-[#a1a1a6] leading-relaxed">
                A Bayesian-flavoured ELO update where evidence strength is the
                model&apos;s own surprise. Upsets move the needle; expected wins
                barely do.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="relative max-w-2xl mx-auto rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-6 sm:p-8 font-mono text-[13px] leading-loose text-[#d2d2d7]">
              <p><span className="text-[#66b2ff]">surprise</span> = 1 − P<sub>model</sub>(observed outcome)</p>
              <p><span className="text-[#30d158]">winner</span>.form ×= 1 + K<sub>win</sub> · surprise · margin_boost</p>
              <p><span className="text-[#ff6961]">loser</span>.form ×= 1 − K<sub>lose</sub> · surprise · margin_boost</p>
              <p><span className="text-[#ffd60a]">both</span>.form ×= 1 ± K<sub>xg</sub> · tanh(ΔxG / 2)</p>
              <p className="text-[#8e8e93]">next_round_odds ∝ base_odds · (form_A / form_B)<sup>γ</sup></p>
            </div>
          </FadeUp>
          <FadeUp delay={0.18}>
            <p className="relative max-w-2xl mx-auto mt-6 text-center text-[13px] text-[#8e8e93] leading-relaxed">
              In stress tests, an unfancied side beating a heavy favourite
              (priced at just 3%) lifts its form index by over +40% — and
              every one of its subsequent fixtures is re-priced instantly,
              with zero retraining. Before kickoff, the index is seeded from
              open betting-market momentum, making the top favourite emerge
              organically from the data.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ── Hybrid Methodology: ML + Generative AI ─────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <GenAIBadge className="mb-6" />
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3]">
                Hybrid Methodology
              </p>
              <h2 className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
                A Hybrid Intelligence Architecture
              </h2>
              <p className="mt-4 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                The engine&apos;s second evolution fuses its calibrated
                statistical core with LLM-powered agentic workflows. Generative
                AI telemetry parsing converts unstructured post-match documents
                — qualitative narrative and hard metrics alike — into
                machine-readable signal for the dynamic Bayesian ELO. This is
                generative AI deployed as a data engineering instrument, not a
                chat interface.
              </p>
            </div>
          </FadeUp>

          {/* Architecture visualization */}
          <FadeUp delay={0.08}>
            <div className="mb-12">
              <HybridPipelineDiagram />
            </div>
          </FadeUp>

          <StaggerGrid className="grid sm:grid-cols-2 gap-4">
            {HYBRID_STEPS.map(({ icon: Icon, title, body }, i) => (
              <StaggerItem key={title}>
                <div className="h-full rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500/15 to-[#0071e3]/15">
                      <Icon className="w-[18px] h-[18px] text-violet-600 dark:text-violet-400" />
                    </span>
                    <span className="text-[11px] font-bold text-[#86868b] dark:text-[#8e8e93]">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                    {body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ── Data Compliance & IP Integrity ─────────────────── */}
      <section id="compliance" className="px-6 pb-20 scroll-mt-24">
        <div className="max-w-5xl mx-auto rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] px-6 sm:px-12 py-14">
          <FadeUp>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-3xl bg-[#30d158]/12 mb-5">
                <ShieldCheck className="w-6 h-6 text-[#30d158]" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#30d158]">
                Data Compliance &amp; IP Integrity
              </p>
              <h2 className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
                Built to respect the rules of the game
              </h2>
            </div>
          </FadeUp>
          <StaggerGrid className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <StaggerItem>
              <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-7">
                <Scale className="w-5 h-5 text-[#0071e3] mb-4" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Generic terminology by design
                </h3>
                <p className="mt-2.5 text-[13.5px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                  Major international sporting events are protected by some of
                  the strictest trademark and ambush-marketing regulations in
                  commercial law. This project deliberately avoids all
                  protected event names, marks, logos, and venue branding —
                  referring only to a generic &ldquo;global football
                  tournament&rdquo;. The forecasting science is identical; the
                  legal exposure is zero.
                </p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="h-full rounded-3xl bg-white dark:bg-[#2c2c2e] p-7">
                <Lock className="w-5 h-5 text-[#0071e3] mb-4" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Shadow data analysis
                </h3>
                <p className="mt-2.5 text-[13.5px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                  All inputs come from publicly available team statistics and
                  open betting-market signals — no official feeds, no licensed
                  data products, no proprietary content. Results are tracked
                  exclusively from publicly reported final scores. Operating
                  in the &ldquo;data shadow&rdquo; of an event is a real-world
                  constraint for analytics vendors, and handling it correctly
                  is part of the engineering brief — commercial and legal
                  maturity as a feature, not an afterthought.
                </p>
              </div>
            </StaggerItem>
          </StaggerGrid>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="px-6 pb-28">
        <FadeUp>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
              See the engine in motion.
            </h2>
            <p className="mt-3 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6]">
              Live projections, prediction tracking, and the dynamic form
              index — straight from the engine&apos;s own output files.
            </p>
            <Link
              href="/projects/football-predictive-engine/dashboard"
              className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#0071e3] text-white text-[15px] font-medium transition-all duration-200 hover:bg-[#0077ed] hover:shadow-[0_0_26px_rgba(0,113,227,0.4)] active:scale-[0.97] no-underline"
            >
              Explore Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeUp>
      </section>
    </>
  );
}
