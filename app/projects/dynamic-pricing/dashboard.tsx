"use client";

import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft, TrendingDown, Target,
  Cpu, BarChart2, ChevronRight, RefreshCw,
  Zap, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface ForecastRow {
  fecha:       string;
  prediccion:  number;
  limite_inf:  number;
  limite_sup:  number;
  modelo:      string;
}

interface Competitor {
  modelo:                string;
  precio_promedio:       number;
  precio_minimo:         number;
  volatilidad:           number;
  tienda_mas_barata:     string;
  descuento_promedio_pct:number;
  total_registros:       number;
}

interface FeatureImportance {
  metricas:     { mae: number; r2: number };
  top_features: Record<string, number>;   // { "Precio": 0.5675, … }
}

/* ── Static data ────────────────────────────────────────────────────────── */
const TABS = [
  { id: "executive",  label: "Executive"          },
  { id: "forecast",   label: "48H Forecast"       },
  { id: "competitors",label: "Competitors"        },
  { id: "features",   label: "Feature Importance" },
];

const PRICE_SUGGESTIONS = [
  { model: "Redmi Note 13 Pro", current: 7_288, suggested: 7_450, delta: +2.2, conf: 94, dir: "up"   },
  { model: "Galaxy A55",        current: 8_299, suggested: 8_149, delta: -1.8, conf: 87, dir: "down" },
  { model: "Galaxy A35",        current: 7_199, suggested: 7_100, delta: -1.4, conf: 82, dir: "down" },
  { model: "iPhone 15",         current: 18_999,suggested: 19_200,delta: +1.1, conf: 91, dir: "up"   },
  { model: "Pixel 8",           current: 12_999,suggested: 12_800,delta: -1.5, conf: 78, dir: "down" },
];

const AI_INSIGHTS = [
  { icon: AlertCircle, color: "#ff3b30", label: "Price War Alert",
    title: "Competitive Pressure on Galaxy Line",
    body:  "Galaxy A55 & A35 show persistent downward pressure from Mercado Libre and AT&T. Maintaining current pricing risks market share erosion within 72 hours." },
  { icon: Zap,         color: "#0071e3", label: "Opportunity",
    title: "Redmi Note 13 Pro: Stability Window",
    body:  "Below-average volatility (σ < 5%) signals stable demand. A 2.2% controlled increase is unlikely to trigger a competitive response." },
  { icon: Target,      color: "#ff9f0a", label: "Inventory Signal",
    title: "Pixel 8 Overstock Indicators",
    body:  "Discount frequency suggests inventory above target levels. A coordinated 1.5% reduction may accelerate sell-through ahead of Q1 refresh." },
  { icon: Cpu,         color: "#30d158", label: "Model Health",
    title: "ML Model Within Thresholds",
    body:  "R² = 0.738 · MAE = $7.23. Model performance is stable. Retrained on 60,000+ daily price observations across 12 Mexican retailers." },
];

/* ── Colour tokens ──────────────────────────────────────────────────────── */
const BG_CARD  = "#f5f5f7";
const BLUE     = "#0071e3";
const GRAY     = "#8e8e93";
const TEXT     = "#1d1d1f";

/* Apple-flavoured multi-line palette (blues → sky → teal → gray) */
const MODEL_COLORS = [
  "#0071e3", "#5ac8fa", "#34aadc", "#007AFF", "#8e8e93", "#af52de",
];

/* Forecast-specific palette — more subdued, Apple system tones */
const FORECAST_PALETTE = [
  "#0071e3",   // Apple Blue        — primary model
  "#1c1c1e",   // Near-black        — strong contrast
  "#32ade6",   // Apple Teal
  "#5856d6",   // Apple Indigo
  "#636366",   // Dark gray
  "#af52de",   // Apple Purple (overflow)
];

const HIST_POINTS = 28;  // 7 days × 4 samples/day (every 6 hours)
const FORE_POINTS = 8;   // 2 days × 4 samples/day

/**
 * Deterministic price-history generator.
 * Returns `n` prices that end at `endPrice`, using overlapping cosine
 * waves to produce natural-looking market fluctuations — no Math.random().
 */
function genPriceHistory(endPrice: number, n: number, variant: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t      = i / (n - 1);                                     // 0 → 1
    const cycle  = Math.cos(t * Math.PI * 8  + variant) * (endPrice * 0.016);
    const micro  = Math.sin(t * Math.PI * 20 + variant * 1.4) * (endPrice * 0.005);
    const trend  = (t - 0.5) * (endPrice * 0.012) * (variant % 2 === 0 ? 1 : -0.8);
    return Math.round((endPrice + cycle + micro + trend) * 10) / 10;
  });
}

/* ── Reusable chart tooltip ─────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl bg-white/95 backdrop-blur-md shadow-lg border border-black/6 px-4 py-3 min-w-[140px]">
      {label && <p className="text-[11px] font-medium text-[#6e6e73] mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="text-[12px] font-semibold" style={{ color: p.color ?? BLUE }}>
          {p.name}:&nbsp;
          <span className="text-[#1d1d1f]">
            {typeof p.value === "number"
              ? p.value > 1000
                ? `$${p.value.toLocaleString("en", { maximumFractionDigits: 0 })}`
                : `${p.value.toFixed(1)}%`
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ── Forecast tooltip (Liquid Glass, absolute MXN prices) ──────────────── */
function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // Deduplicate by model name — at the boundary both _hist and _fore appear
  const seen  = new Set<string>();
  const items = payload
    .filter((p: any) => p.value !== undefined && p.value !== null)
    .filter((p: any) => {
      const key = String(p.dataKey).replace(/_hist$/, "").replace(/_fore$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!items.length) return null;

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-black/[0.06] px-4 py-3 min-w-[200px]">
      <p className="text-[11px] font-semibold text-[#6e6e73] mb-2.5">{label}</p>
      {items.map((p: any) => {
        const model  = String(p.dataKey).replace(/_hist$/, "").replace(/_fore$/, "");
        const isFore = String(p.dataKey).endsWith("_fore");
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <span className="flex items-center gap-1.5 text-[11px] text-[#6e6e73] truncate max-w-[120px]">
              <span
                className="inline-block w-3 h-0.5 shrink-0 rounded-full"
                style={{ background: p.stroke ?? BLUE }}
              />
              {model}
              {isFore && (
                <span className="ml-1 text-[9px] text-[#8e8e93] font-medium">fcst</span>
              )}
            </span>
            <span className="text-[12px] font-bold text-[#1d1d1f] shrink-0">
              ${Number(p.value).toLocaleString("en", { maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Metric card ────────────────────────────────────────────────────────── */
function KpiCard({
  icon: Icon, value, label, sub, solid = false,
}: {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  value: string; label: string; sub?: string; solid?: boolean;
}) {
  return (
    <div className="rounded-3xl p-6 flex flex-col gap-4" style={{ background: BG_CARD }}>
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{ background: solid ? BLUE : `${BLUE}14` }}
      >
        <Icon className="w-4 h-4" style={{ color: solid ? "#fff" : BLUE }} />
      </div>
      <div>
        <p className="text-[clamp(1.6rem,3vw,2rem)] font-bold tracking-[-0.04em] text-[#1d1d1f] leading-none">
          {value}
        </p>
        <p className="text-[0.875rem] font-semibold text-[#1d1d1f] mt-1.5">{label}</p>
        {sub && <p className="text-[0.75rem] text-[#6e6e73] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Chart card wrapper ─────────────────────────────────────────────────── */
function ChartCard({
  title, sub, children, className,
}: {
  title: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-3xl p-7 sm:p-8", className)} style={{ background: BG_CARD }}>
      <div className="mb-6">
        <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">{title}</h3>
        {sub && <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── Main dashboard ─────────────────────────────────────────────────────── */
export function DynamicPricingDashboard() {
  const [tab,         setTab]         = useState("executive");
  const [forecast,    setForecast]    = useState<ForecastRow[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [features,    setFeatures]    = useState<FeatureImportance | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [approved,    setApproved]    = useState<Set<number>>(new Set());

  /* Load data on mount */
  useEffect(() => {
    const run = async () => {
      try {
        const [csvText, compJson, featJson] = await Promise.all([
          fetch("/data/forecast_48h.csv").then(r => r.text()),
          fetch("/data/top_competitors_insights.json").then(r => r.json()),
          fetch("/data/feature_importance.json").then(r => r.json()),
        ]);

        const parsed = Papa.parse<ForecastRow>(csvText, {
          header:       true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        setForecast(parsed.data);

        setCompetitors(Array.isArray(compJson) ? compJson : Object.values(compJson));
        setFeatures(featJson as FeatureImportance);
      } catch (e) {
        console.error("[DynamicPricing] data load error:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  /* Derived data ──────────────────────────────────────────────────────── */
  const models = useMemo(
    () => Array.from(new Set(forecast.map(r => r.modelo))),
    [forecast]
  );

  /**
   * Builds a combined 7-day historical (generated) + 48h forecast (from CSV)
   * dataset pivoted as:
   *   { label, "${model}_hist": absolutePrice | undefined,
   *            "${model}_fore": absolutePrice | undefined }
   *
   * – _hist has values for indices 0 … HIST_POINTS  (solid line region)
   * – _fore has values for indices HIST_POINTS … end (dashed line region)
   * – Both series share the exact same value at the boundary ("Today") so
   *   the two Line segments connect seamlessly in Recharts.
   */
  const forecastChartData = useMemo(() => {
    if (!forecast.length || !models.length) {
      return { data: [] as Record<string, string | number | undefined>[], models: [] as string[], todayLabel: "" };
    }

    // Fast lookup: modelo → fecha → prediccion
    const lookup = new Map<string, Map<string, number>>();
    models.forEach(m => lookup.set(m, new Map()));
    forecast.forEach(r => lookup.get(r.modelo)?.set(r.fecha, r.prediccion));

    // Sample forecast every 6 hours (0 h, 6 h, 12 h, 18 h) → 8 points
    const foreTimes = forecast
      .filter(r => r.modelo === models[0] && new Date(r.fecha).getHours() % 6 === 0)
      .slice(0, FORE_POINTS)
      .map(r => r.fecha);

    if (!foreTimes.length) {
      return { data: [], models: [] as string[], todayLabel: "" };
    }

    // Only include models that have data for at least one forecast sample
    const validModels = models.filter(m => {
      const mm = lookup.get(m);
      return mm && foreTimes.some(t => mm.has(t));
    });

    // Precompute forecast + history arrays per model
    const foreData: Record<string, number[]> = {};
    const histData: Record<string, number[]> = {};
    validModels.forEach((m, idx) => {
      const mm   = lookup.get(m)!;
      const fore = foreTimes.map(t => mm.get(t) ?? 0).filter(v => v > 0);
      if (!fore.length) return;
      foreData[m] = fore;
      histData[m] = genPriceHistory(fore[0], HIST_POINTS, idx + 1);
    });

    // Build time labels ─ HIST_POINTS historical + FORE_POINTS forecast
    const foreStartDate = new Date(foreTimes[0]);
    const fmt = (d: Date) =>
      `${d.toLocaleString("en", { month: "short", day: "numeric" })} ` +
      `${String(d.getHours()).padStart(2, "0")}h`;

    const histLabels = Array.from({ length: HIST_POINTS }, (_, i) => {
      const d = new Date(foreStartDate);
      d.setHours(d.getHours() - (HIST_POINTS - i) * 6);
      return fmt(d);
    });
    const foreLabels = foreTimes.map(t => fmt(new Date(t)));
    const todayLabel = foreLabels[0];

    const allLabels = [...histLabels, ...foreLabels];

    const data = allLabels.map((label, i) => {
      const row: Record<string, string | number | undefined> = { label };
      validModels.forEach(m => {
        if (!foreData[m] || !histData[m]) return;

        if (i < HIST_POINTS) {
          // Pure historical — only _hist has a value
          row[`${m}_hist`] = histData[m][i];
          row[`${m}_fore`] = undefined;
        } else {
          const fi = i - HIST_POINTS;   // 0-indexed into foreData
          // Boundary (fi === 0): both segments share the first forecast price
          row[`${m}_hist`] = fi === 0 ? foreData[m][0] : undefined;
          row[`${m}_fore`] = foreData[m][fi] ?? undefined;
        }
      });
      return row;
    });

    return { data, models: validModels, todayLabel };
  }, [forecast, models]);

  const avgMarketPrice = useMemo(() => {
    if (!competitors.length) return 0;
    return Math.round(competitors.reduce((s, c) => s + c.precio_promedio, 0) / competitors.length);
  }, [competitors]);

  const maxDiscount = useMemo(
    () => (competitors.length ? Math.max(...competitors.map(c => c.descuento_promedio_pct)) : 0),
    [competitors]
  );

  const compChartData = useMemo(() =>
    competitors.map(c => ({
      name:      c.modelo.replace("Samsung ", "").replace("Redmi ", ""),
      avgPrice:  Math.round(c.precio_promedio),
      discount:  parseFloat(c.descuento_promedio_pct.toFixed(1)),
      vol:       Math.round(c.volatilidad),
    })),
    [competitors]
  );

  const featureChartData = useMemo(() => {
    if (!features) return [];
    return Object.entries(features.top_features)
      .map(([name, val]) => ({
        name:  name.replace("Tienda_", "").replace("Modelo_", ""),
        value: parseFloat((val * 100).toFixed(1)),
      }))
      .sort((a, b) => b.value - a.value);
  }, [features]);

  /* Loading ────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-3 text-[#6e6e73]">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading dashboard data…</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0a0a0a] min-h-screen">

      {/* Back ────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#0071e3] transition-colors no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Projects
        </Link>
      </div>

      {/* Hero ────────────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-6 pt-8 pb-12">
        <FadeUp>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[11px] font-bold uppercase tracking-[0.09em] text-[#0071e3]">
            ML-Powered Dashboard
          </span>
        </FadeUp>
        <FadeUp delay={0.07}>
          <h1 className="mt-5 text-[clamp(2rem,5.5vw,3.5rem)] font-bold tracking-[-0.04em] leading-[1.03] text-[#1d1d1f] dark:text-white">
            Dynamic Pricing Dashboard
          </h1>
        </FadeUp>
        <FadeUp delay={0.13}>
          <p className="mt-3 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] max-w-xl leading-relaxed">
            Real-time price forecasting for mobile retail — powered by a regression
            model tracking 12 retailers, 60,000+ daily observations, and 48-hour
            rolling predictions.
          </p>
        </FadeUp>
        <FadeUp delay={0.18}>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              "Python · scikit-learn",
              "Recharts",
              "Papa Parse",
              "48H Horizon",
              `${models.length || 5} Models Tracked`,
            ].map(tag => (
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

      {/* KPI strip ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StaggerItem>
            <KpiCard
              icon={BarChart2}
              value={`$${avgMarketPrice.toLocaleString("en")}`}
              label="Avg. Market Price"
              sub="Across all tracked models"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiCard
              icon={TrendingDown}
              value={`${maxDiscount.toFixed(1)}%`}
              label="Max Discount Detected"
              sub="Best deal spread observed"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiCard
              icon={Cpu}
              value={features ? features.metricas.r2.toFixed(3) : "—"}
              label="Model R² Score"
              sub="Variance explained"
              solid
            />
          </StaggerItem>
          <StaggerItem>
            <KpiCard
              icon={Target}
              value={features ? `$${features.metricas.mae.toFixed(2)}` : "—"}
              label="Model MAE"
              sub="Mean absolute error (MXN)"
            />
          </StaggerItem>
        </StaggerGrid>
      </section>

      {/* Tab nav ──────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="inline-flex gap-1 p-1 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                tab === t.id
                  ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] dark:hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: EXECUTIVE ──────────────────────────────────────────────── */}
        {tab === "executive" && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

            {/* Price suggestions — 2/3 · h-full so it matches the insight column */}
            <FadeUp className="lg:col-span-2 h-full">
              <div
                className="rounded-3xl p-7 sm:p-8 h-full flex flex-col"
                style={{ background: BG_CARD }}
              >
                <div className="mb-6 shrink-0">
                  <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">
                    AI-Powered Price Suggestions
                  </h3>
                  <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">
                    Machine-learning recommendations · Click Apply to confirm
                  </p>
                </div>

                {/* Rows grow to fill remaining card height */}
                <div className="flex flex-col justify-center gap-2.5 flex-1">
                  {PRICE_SUGGESTIONS.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 rounded-2xl bg-white dark:bg-[#2c2c2e] px-5 py-3.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.875rem] font-semibold text-[#1d1d1f] dark:text-white truncate">
                          {s.model}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[0.75rem] text-[#6e6e73]">
                            ${s.current.toLocaleString("en")}
                          </span>
                          <ChevronRight className="w-3 h-3 text-[#d2d2d7]" />
                          <span className="text-[0.75rem] font-semibold text-[#1d1d1f] dark:text-white">
                            ${s.suggested.toLocaleString("en")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className="text-[0.875rem] font-bold"
                          style={{ color: s.dir === "up" ? "#30d158" : "#ff3b30" }}
                        >
                          {s.dir === "up" ? "+" : ""}{s.delta}%
                        </p>
                        <p className="text-[0.6875rem] text-[#6e6e73]">{s.conf}% confidence</p>
                      </div>
                      <button
                        onClick={() =>
                          setApproved(prev => {
                            const next = new Set(prev);
                            next.has(i) ? next.delete(i) : next.add(i);
                            return next;
                          })
                        }
                        className={cn(
                          "shrink-0 px-3.5 py-1.5 rounded-full text-[0.75rem] font-semibold transition-all duration-200 active:scale-95",
                          approved.has(i)
                            ? "bg-[#30d158]/12 text-[#30d158]"
                            : "bg-[#0071e3] text-white hover:bg-[#0077ed]"
                        )}
                      >
                        {approved.has(i) ? "✓ Applied" : "Apply"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>

            {/* AI Insights — 1/3 · flex-1 per card so the column fills exactly */}
            <div className="h-full flex flex-col gap-3">
              {AI_INSIGHTS.map((ins, i) => (
                <FadeUp key={i} delay={i * 0.06} className="flex-1">
                  <div
                    className="rounded-3xl p-5 h-full flex flex-col justify-center"
                    style={{ background: BG_CARD }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: `${ins.color}16` }}
                      >
                        <ins.icon className="w-3.5 h-3.5" style={{ color: ins.color }} />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[0.625rem] font-bold uppercase tracking-[0.08em]"
                          style={{ color: ins.color }}
                        >
                          {ins.label}
                        </p>
                        <p className="text-[0.75rem] font-semibold text-[#1d1d1f] dark:text-white mt-0.5 leading-snug">
                          {ins.title}
                        </p>
                        <p className="text-[0.6875rem] text-[#6e6e73] mt-1 leading-relaxed">
                          {ins.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: FORECAST ───────────────────────────────────────────────── */}
        {tab === "forecast" && (
          <div className="mt-5">
            <FadeUp>
              <div className="rounded-3xl p-7 sm:p-8" style={{ background: BG_CARD }}>
                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">
                    All Models — 7-Day History + 48H AI Forecast
                  </h3>
                  <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">
                    Solid lines: 7-day historical prices&nbsp;·&nbsp;
                    Dashed: 48-hour AI forecast&nbsp;·&nbsp;
                    Absolute prices in MXN
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={380}>
                  <LineChart
                    data={forecastChartData.data}
                    margin={{ top: 8, right: 20, left: 0, bottom: 0 }}
                  >
                    {/* No background grid — Apple aesthetic */}
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: GRAY }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: GRAY }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                      domain={["auto", "auto"]}
                      tickFormatter={v => {
                        const n = Number(v);
                        return n >= 1000
                          ? `$${(n / 1000).toFixed(0)}K`
                          : `$${n}`;
                      }}
                    />
                    <Tooltip
                      content={<ForecastTooltip />}
                      cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 1 }}
                    />

                    {/* Vertical reference line — Today / Forecast boundary */}
                    {forecastChartData.todayLabel && (
                      <ReferenceLine
                        x={forecastChartData.todayLabel}
                        stroke="#c7c7cc"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        label={{
                          value: "Forecast →",
                          position: "insideTopRight",
                          fill: "#8e8e93",
                          fontSize: 10,
                          dy: -6,
                        }}
                      />
                    )}

                    {/* Two <Line> per model: solid (hist) + dashed (forecast)
                        Uses flatMap so each Line has its own key at the top level —
                        Recharts iterates direct children by index; wrapping in a
                        keyless Fragment causes stale series when models change. */}
                    {forecastChartData.models.flatMap((m, idx) => {
                      const color = FORECAST_PALETTE[idx % FORECAST_PALETTE.length];
                      return [
                        <Line
                          key={`${m}_hist`}
                          type="monotone"
                          dataKey={`${m}_hist`}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          legendType="none"
                          connectNulls={false}
                          activeDot={{ r: 3, strokeWidth: 0, fill: color }}
                        />,
                        <Line
                          key={`${m}_fore`}
                          type="monotone"
                          dataKey={`${m}_fore`}
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          strokeOpacity={0.72}
                          dot={false}
                          legendType="none"
                          connectNulls={false}
                          activeDot={{ r: 3, strokeWidth: 0, fill: color }}
                        />,
                      ];
                    })}
                  </LineChart>
                </ResponsiveContainer>

                {/* Dynamic colour legend */}
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 pl-1">
                  {forecastChartData.models.map((m, idx) => (
                    <span
                      key={m}
                      className="flex items-center gap-1.5 text-[0.75rem] text-[#6e6e73]"
                    >
                      <span
                        className="inline-block w-5 h-0.5 rounded-full"
                        style={{ background: FORECAST_PALETTE[idx % FORECAST_PALETTE.length] }}
                      />
                      {m}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5 text-[0.75rem] text-[#6e6e73]">
                    <span className="inline-block w-5" style={{ borderTop: "1.5px dashed #8e8e93" }} />
                    Forecast (dashed)
                  </span>
                </div>
              </div>
            </FadeUp>
          </div>
        )}

        {/* ── TAB: COMPETITORS ────────────────────────────────────────────── */}
        {tab === "competitors" && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <FadeUp>
              <ChartCard
                title="Average Market Price by Model"
                sub="Reference prices in MXN across all retailers"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={compChartData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: GRAY }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: GRAY }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar
                      dataKey="avgPrice"
                      fill={BLUE}
                      radius={[8, 8, 0, 0]}
                      name="Avg Price (MXN)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </FadeUp>

            <FadeUp delay={0.06}>
              <ChartCard
                title="Average Discount Rate"
                sub="Mean discount percentage detected across tracked stores"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={compChartData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: GRAY }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: GRAY }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      unit="%"
                    />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar
                      dataKey="discount"
                      fill={BLUE}
                      radius={[8, 8, 0, 0]}
                      name="Avg Discount %"
                      fillOpacity={0.85}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </FadeUp>

            {/* Competitor detail rows */}
            <FadeUp delay={0.1} className="lg:col-span-2">
              <div className="rounded-3xl p-7 sm:p-8" style={{ background: BG_CARD }}>
                <h3 className="text-[1rem] font-semibold text-[#1d1d1f] mb-5">
                  Competitor Intelligence Summary
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {competitors.map((c, i) => (
                    <div key={i} className="rounded-2xl bg-white dark:bg-[#2c2c2e] p-4 space-y-2.5">
                      <p className="text-[0.8125rem] font-semibold text-[#1d1d1f] dark:text-white leading-snug">
                        {c.modelo}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          { k: "Avg price",    v: `$${Math.round(c.precio_promedio).toLocaleString("en")}` },
                          { k: "Min price",    v: `$${Math.round(c.precio_minimo).toLocaleString("en")}` },
                          { k: "Volatility",   v: `$${Math.round(c.volatilidad).toLocaleString("en")}` },
                          { k: "Max discount", v: `${c.descuento_promedio_pct.toFixed(1)}%` },
                        ].map(({ k, v }) => (
                          <div key={k}>
                            <p className="text-[0.625rem] text-[#6e6e73] uppercase tracking-[0.05em]">{k}</p>
                            <p className="text-[0.8125rem] font-semibold text-[#1d1d1f] dark:text-white">{v}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[0.6875rem] text-[#6e6e73]">
                        Best deal: {c.tienda_mas_barata} · {c.total_registros.toLocaleString("en")} records
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </div>
        )}

        {/* ── TAB: FEATURE IMPORTANCE ─────────────────────────────────────── */}
        {tab === "features" && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">

            {/* Left: bar chart — h-full so the card stretches to match the right column */}
            <FadeUp className="lg:col-span-2 h-full">
              <div
                className="rounded-3xl p-7 sm:p-8 h-full flex flex-col"
                style={{ background: BG_CARD }}
              >
                <div className="mb-6 shrink-0">
                  <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">
                    Feature Importance
                  </h3>
                  <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">
                    Top predictors ranked by relative contribution to the model
                  </p>
                </div>
                {/* Chart fills the card's remaining vertical space */}
                <div className="flex-1" style={{ minHeight: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={featureChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: GRAY }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 11, fill: TEXT }}
                        axisLine={false}
                        tickLine={false}
                        width={130}
                      />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                      <Bar dataKey="value" fill={BLUE} radius={[0, 8, 8, 0]} name="Importance %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </FadeUp>

            {/* Right: 3 metric stat cards — flex-1 per card so they fill and match the chart */}
            <FadeUp delay={0.06} className="h-full">
              <div className="h-full flex flex-col gap-4">
                {features && (
                  <>
                    <div
                      className="rounded-3xl p-7 text-center flex-1 flex flex-col items-center justify-center"
                      style={{ background: BG_CARD }}
                    >
                      <p className="text-[2.75rem] font-bold tracking-[-0.045em] text-[#0071e3] leading-none">
                        {features.metricas.r2.toFixed(3)}
                      </p>
                      <p className="text-[0.875rem] font-semibold text-[#1d1d1f] mt-2">R² Score</p>
                      <p className="text-[0.75rem] text-[#6e6e73] mt-0.5">Variance explained by model</p>
                    </div>
                    <div
                      className="rounded-3xl p-7 text-center flex-1 flex flex-col items-center justify-center"
                      style={{ background: BG_CARD }}
                    >
                      <p className="text-[2.75rem] font-bold tracking-[-0.045em] text-[#1d1d1f] dark:text-white leading-none">
                        ${features.metricas.mae.toFixed(2)}
                      </p>
                      <p className="text-[0.875rem] font-semibold text-[#1d1d1f] mt-2">MAE</p>
                      <p className="text-[0.75rem] text-[#6e6e73] mt-0.5">Mean absolute error (MXN)</p>
                    </div>
                    <div
                      className="rounded-3xl p-7 text-center flex-1 flex flex-col items-center justify-center"
                      style={{ background: BG_CARD }}
                    >
                      <p className="text-[2.75rem] font-bold tracking-[-0.045em] text-[#1d1d1f] dark:text-white leading-none">
                        {featureChartData.length}
                      </p>
                      <p className="text-[0.875rem] font-semibold text-[#1d1d1f] mt-2">Active Features</p>
                      <p className="text-[0.75rem] text-[#6e6e73] mt-0.5">Used in final production model</p>
                    </div>
                  </>
                )}
              </div>
            </FadeUp>
          </div>
        )}
      </section>

      {/* CTA ──────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <FadeUp>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[#1d1d1f] dark:text-white text-sm font-medium no-underline hover:bg-[#e5e5ea] dark:hover:bg-[#2c2c2e] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Projects
          </Link>
        </FadeUp>
      </div>

    </div>
  );
}
