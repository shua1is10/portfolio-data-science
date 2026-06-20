"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  Clock, Brain, TrendingUp, AlertTriangle,
  Moon, ArrowLeft, ArrowRight,
  Globe, Activity, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";

/* ── Types ────────────────────────────────────────────────────────────────── */
interface KeyMetrics {
  avg_daily_screen_hours:       number;
  avg_focus_span_minutes:       number;
  pct_high_addiction:           number;
  corr_engagement_addiction:    number;
  corr_addiction_sleep:         number;
  countries_analyzed:           number;
  total_observations:           number;
}
interface YearPoint  { year: number; tiktok_minutes: number; instagram_minutes: number; }
interface AttPoint   { year: number; attention_span: number; addiction_score: number; impulsivity: number; }
interface CountryRow { country: string; tiktok: number; instagram: number; total: number; addiction_score: number; }
interface AgeRow     { age_group: string; mean_focus: number; std_focus: number; }
interface InsightItem{
  id: number; icon: string; stat: string; color: string;
  title: string; body: string;
}
export interface DashboardData {
  key_metrics:            KeyMetrics;
  tiktok_vs_instagram:    YearPoint[];
  attention_trend:        AttPoint[];
  top5_platform_exposure: CountryRow[];
  focus_by_age:           AgeRow[];
  insights:               InsightItem[];
}

/* ── Colour tokens (chart) ────────────────────────────────────────────────── */
const BLUE   = "#0071e3";
const GRAY   = "#8e8e93";
const DBLUE  = "#60a5fa";   // lighter blue for dark mode
const DGRAY  = "#6b7280";

/* ── Tooltip ──────────────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl bg-white/90 dark:bg-[#2c2c2e]/95 backdrop-blur-md border border-[#e5e5ea] dark:border-[#3a3a3c] shadow-lg px-4 py-3 text-left">
      {label && (
        <p className="text-[11px] font-semibold text-[#6e6e73] dark:text-[#8e8e93] mb-1.5">
          {label}
        </p>
      )}
      {payload.map((p: any) => (
        <p key={p.name} className="text-[12px] font-medium" style={{ color: p.color }}>
          {p.name}:&nbsp;
          <span className="text-[#1d1d1f] dark:text-white font-bold">{p.value}</span>
          {p.unit || ""}
        </p>
      ))}
    </div>
  );
}

/* ── Insight icon resolver ────────────────────────────────────────────────── */
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  TrendingUp:    TrendingUp,
  Brain:         Brain,
  Moon:          Moon,
  AlertTriangle: AlertTriangle,
  Globe:         Globe,
  Activity:      Activity,
  Zap:           Zap,
};

const INSIGHT_COLORS: Record<string, { bg: string; text: string; statColor: string }> = {
  blue:   { bg: "bg-[#eff6ff] dark:bg-[#1e3a5f]", text: "text-[#0071e3]",   statColor: "text-[#0071e3]" },
  amber:  { bg: "bg-[#fffbeb] dark:bg-[#3d2e00]", text: "text-amber-600",    statColor: "text-amber-500" },
  violet: { bg: "bg-[#f5f3ff] dark:bg-[#2e1f5e]", text: "text-violet-600",   statColor: "text-violet-500" },
  rose:   { bg: "bg-[#fff1f2] dark:bg-[#3d1414]", text: "text-rose-600",     statColor: "text-rose-500" },
};

/* ── Metric Card ──────────────────────────────────────────────────────────── */
function MetricCard({
  icon: Icon, label, value, unit, sub, accentColor,
}: {
  icon: React.FC<{ className?: string }>;
  label: string; value: string | number; unit?: string;
  sub?: string; accentColor?: string;
}) {
  return (
    <div className="rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] p-6 flex flex-col gap-4">
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center",
        accentColor ?? "bg-[#0071e3]/10"
      )}>
        <Icon className={cn("w-4.5 h-4.5", accentColor ? "text-white" : "text-[#0071e3]")} />
      </div>
      <div>
        <p className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.04em] text-[#1d1d1f] dark:text-white leading-none">
          {value}
          {unit && <span className="text-[1.25rem] font-medium ml-1 text-[#6e6e73]">{unit}</span>}
        </p>
        <p className="mt-1.5 text-sm font-semibold text-[#1d1d1f] dark:text-white/90">
          {label}
        </p>
        {sub && (
          <p className="mt-0.5 text-[12px] text-[#6e6e73] dark:text-[#8e8e93] leading-tight">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Section header ───────────────────────────────────────────────────────── */
function SectionHeader({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0071e3] mb-2">
        {label}
      </p>
      <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-white">
        {title}
      </h2>
      {sub && (
        <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#8e8e93]">{sub}</p>
      )}
    </div>
  );
}

/* ── MAIN DASHBOARD ───────────────────────────────────────────────────────── */
export function InsightsDashboard({ data }: { data: DashboardData }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isDark     = mounted && resolvedTheme === "dark";
  const lineBlue   = isDark ? DBLUE : BLUE;
  const lineGray   = isDark ? DGRAY : GRAY;
  const axisColor  = isDark ? "#6b7280" : "#8e8e93";
  const gridColor  = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const bgTooltip  = isDark ? "#2c2c2e" : "#ffffff";

  const { key_metrics: km } = data;

  /* ── Bar chart data: top-5 countries (total minutes, sorted asc for horizontal) */
  const barData = [...data.top5_platform_exposure]
    .sort((a, b) => a.total - b.total);

  return (
    <div className="bg-white dark:bg-[#0a0a0a] min-h-screen">

      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] dark:text-[#8e8e93] hover:text-[#0071e3] transition-colors no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Projects
        </Link>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-6 pt-10 pb-16 text-center">
        <FadeUp>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[11px] font-bold uppercase tracking-[0.09em] text-[#0071e3]">
            Data Science Case Study
          </span>
        </FadeUp>

        <FadeUp delay={0.07}>
          <h1 className="mt-5 text-[clamp(2rem,6vw,4rem)] font-bold tracking-[-0.045em] leading-[1.03] text-[#1d1d1f] dark:text-white">
            Global Digital Addiction
            <br className="hidden sm:block" />
            Analysis
          </h1>
        </FadeUp>

        <FadeUp delay={0.13}>
          <p className="mt-4 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] max-w-lg mx-auto leading-relaxed">
            A predictive study of short-form content consumption,
            attention erosion, and mental health trajectories across
            100 countries from 2015 to 2060.
          </p>
        </FadeUp>

        {/* Data tags */}
        <FadeUp delay={0.18}>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {[
              `${km.countries_analyzed} Countries`,
              `${km.total_observations.toLocaleString()} Observations`,
              "2015 – 2060",
              "Python · scikit-learn · recharts",
            ].map((tag) => (
              <span
                key={tag}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[#6e6e73] dark:text-[#8e8e93]"
              >
                {tag}
              </span>
            ))}
          </div>
        </FadeUp>
      </header>

      {/* ── SECTION 1: Key Metrics ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <FadeUp>
          <SectionHeader
            label="At a glance"
            title="Key Metrics"
            sub="Computed from 60,100 observations across 3 datasets."
          />
        </FadeUp>

        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <MetricCard
              icon={Clock}
              value={km.avg_daily_screen_hours}
              unit="hrs"
              label="Avg. Daily Screen Time"
              sub="Weighted weekday/weekend average"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={Brain}
              value={km.avg_focus_span_minutes}
              unit="min"
              label="Mean Focus Span"
              sub="Stable across all age groups"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={TrendingUp}
              value={km.corr_engagement_addiction}
              label="Engagement → Addiction"
              sub="Pearson r across 100 countries"
              accentColor="bg-[#0071e3]"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              icon={AlertTriangle}
              value={`${km.pct_high_addiction}%`}
              label="High Addiction Risk"
              sub="Across 10,000 global projections"
              accentColor="bg-rose-500"
            />
          </StaggerItem>
        </StaggerGrid>
      </section>

      {/* ── SECTION 2A: Platform Battle Line Chart ────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-6">
        <FadeUp>
          <div className="rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] p-8 sm:p-10">
            <SectionHeader
              label="Platform battle"
              title="TikTok vs. Instagram Daily Usage"
              sub="Global mean daily minutes · 2015 – 2060 (sampled every 5 years)"
            />

            {/* Legend row */}
            <div className="flex items-center gap-5 mb-6 text-[12px] font-medium text-[#6e6e73] dark:text-[#8e8e93]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-0.5 rounded-full" style={{ background: lineBlue }} />
                TikTok
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-0.5 rounded-full" style={{ borderTop: `2px dashed ${lineGray}` }} />
                Instagram
              </span>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={data.tiktok_vs_instagram}
                margin={{ top: 4, right: 12, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="0"
                  horizontal vertical={false}
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  unit=" min"
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: gridColor, strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="tiktok_minutes"
                  name="TikTok"
                  stroke={lineBlue}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: lineBlue, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="instagram_minutes"
                  name="Instagram"
                  stroke={lineGray}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 5, fill: lineGray, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FadeUp>
      </section>

      {/* ── SECTION 2B: Top 5 Countries Bar Chart ─────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <FadeUp delay={0.06}>
          <div className="rounded-[2.5rem] bg-[#f5f5f7] dark:bg-[#1d1d1f] p-8 sm:p-10">
            <SectionHeader
              label="Country analysis"
              title="Highest Total Platform Exposure"
              sub="Combined TikTok + Instagram daily minutes · Top 5 countries"
            />

            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="0"
                  horizontal={false}
                  stroke={gridColor}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  unit=" min"
                />
                <YAxis
                  dataKey="country"
                  type="category"
                  tick={{ fontSize: 12, fill: isDark ? "#e5e5ea" : "#1d1d1f", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="total" name="Total min/day" fill={lineBlue} radius={[0, 8, 8, 0]}>
                  <LabelList
                    dataKey="total"
                    position="right"
                    style={{ fontSize: 11, fill: axisColor, fontWeight: 600 }}
                    formatter={(v: unknown) => typeof v === "number" ? `${v.toFixed(0)}` : String(v ?? "")}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FadeUp>
      </section>

      {/* ── SECTION 3: Insights Horizontal Scroll ─────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <FadeUp>
          <SectionHeader
            label="Key findings"
            title="What the Data Reveals"
          />
        </FadeUp>

        <FadeUp delay={0.06}>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth scrollbar-hide"
            style={{ scrollbarWidth: "none" }}>
            {data.insights.map((ins) => {
              const IconComp = ICON_MAP[ins.icon] ?? Activity;
              const colors   = INSIGHT_COLORS[ins.color] ?? INSIGHT_COLORS.blue;

              return (
                <div
                  key={ins.id}
                  className={cn(
                    "w-72 sm:w-80 shrink-0 snap-start rounded-3xl p-7 flex flex-col gap-4",
                    "bg-[#f5f5f7] dark:bg-[#1d1d1f]"
                  )}
                >
                  {/* Icon badge */}
                  <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", colors.bg)}>
                    <IconComp className={cn("w-4.5 h-4.5", colors.text)} />
                  </div>

                  {/* Big stat */}
                  <p className={cn("text-[2rem] font-bold tracking-[-0.04em] leading-none", colors.statColor)}>
                    {ins.stat}
                  </p>

                  {/* Title + body */}
                  <div className="flex-1 space-y-2">
                    <p className="font-semibold text-[#1d1d1f] dark:text-white text-[0.9375rem] leading-snug">
                      {ins.title}
                    </p>
                    <p className="text-sm text-[#6e6e73] dark:text-[#8e8e93] leading-relaxed">
                      {ins.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FadeUp>
      </section>

      {/* ── CTA Footer ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <FadeUp>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white text-sm font-medium no-underline hover:bg-[#e5e5ea] dark:hover:bg-[#2c2c2e] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Projects
            </Link>
            <a
              href="mailto:joshuaisan17o@gmail.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0071e3] text-white text-sm font-medium no-underline hover:bg-[#0077ed] transition-colors"
            >
              Discuss This Project
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </FadeUp>
      </div>

    </div>
  );
}
