"use client";

import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  ComposedChart, Bar, Line,
  BarChart, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, Sankey,
} from "recharts";
import {
  ArrowLeft, Globe, MousePointerClick, Timer, Layers,
  TrendingUp, TrendingDown, RefreshCw, MapPin,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/ui/animate";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface WebRow {
  date:             string;
  state_mx:         string;
  source:           string;
  landing_page:     string;
  dropoff_page:     string;
  device:           string;
  browser:          string;
  sessions:         number;
  bounce_rate:      number;
  avg_duration_sec: number;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const BLUE       = "#0071e3";
const GRAY       = "#8e8e93";
const BG_CARD    = "#f5f5f7";
const TEXT_DARK  = "#1d1d1f";

const TABS = [
  { id: "overview",  label: "Overview"          },
  { id: "sources",   label: "Traffic Sources"   },
  { id: "pages",     label: "Pages & Flow"      },
  { id: "devices",   label: "Devices & Browsers"},
];

const DEVICE_COLORS  = ["#0071e3", "#5ac8fa", "#34aadc", "#8e8e93"];
const BROWSER_COLORS = ["#0071e3", "#5ac8fa", "#34aadc", "#007AFF", "#8e8e93", "#636366"];

/* ── Helpers ────────────────────────────────────────────────────────────── */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Returns "Apr W1", "Apr W2" etc. for grouping */
function weekLabel(dateStr: string): string {
  const d   = new Date(dateStr);
  const mon = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  const wk  = Math.ceil(day / 7);
  return `${mon} W${wk}`;
}

/* ── Glass tooltip ──────────────────────────────────────────────────────── */
function GlassTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-black/6 px-4 py-3 min-w-[160px]">
      {label && <p className="text-[11px] font-medium text-[#6e6e73] mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="text-[12px] font-semibold" style={{ color: p.color ?? BLUE }}>
          {p.name}:&nbsp;
          <span className="text-[#1d1d1f]">
            {typeof p.value === "number" && p.name?.includes("%")
              ? `${p.value.toFixed(1)}%`
              : typeof p.value === "number"
              ? p.value.toLocaleString("en")
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
interface KpiProps {
  icon:    React.FC<React.SVGProps<SVGSVGElement>>;
  label:   string;
  value:   string;
  sub:     string;
  delta?:  string;
  up?:     boolean;
  alert?:  boolean;
}
function KpiCard({ icon: Icon, label, value, sub, delta, up, alert }: KpiProps) {
  return (
    <div
      className={cn(
        "rounded-3xl p-6 flex flex-col gap-4 transition-all",
        alert ? "bg-[#fff8f0]" : ""
      )}
      style={{ background: alert ? "#fff8f0" : BG_CARD }}
    >
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{ background: alert ? "#ff9f0a18" : `${BLUE}14` }}
      >
        <Icon className="w-4 h-4" style={{ color: alert ? "#ff9f0a" : BLUE }} />
      </div>
      <div>
        <p
          className="text-[clamp(1.5rem,2.8vw,2rem)] font-bold tracking-[-0.04em] leading-none"
          style={{ color: TEXT_DARK }}
        >
          {value}
        </p>
        <p className="text-[0.875rem] font-semibold text-[#1d1d1f] mt-1.5">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[0.75rem] text-[#6e6e73]">{sub}</p>
          {delta && (
            <span
              className="text-[0.6875rem] font-semibold"
              style={{ color: up ? "#30d158" : "#ff3b30" }}
            >
              {up ? <TrendingUp className="inline w-3 h-3 mr-0.5" /> : <TrendingDown className="inline w-3 h-3 mr-0.5" />}
              {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Section card ───────────────────────────────────────────────────────── */
function SectionCard({
  title, sub, children, className,
}: {
  title: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-3xl p-7 sm:p-8", className)} style={{ background: BG_CARD }}>
      <div className="mb-5">
        <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">{title}</h3>
        {sub && <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MEXICO TILE MAP — helpers & data
───────────────────────────────────────────────────────────────────────── */

/** Deterministic grid positions (col 0–8, row 0–4) approximating Mexico's geography */
const MX_TILES = [
  { abbr: "BCN", csvName: "Baja California",     col: 0, row: 0 },
  { abbr: "SON", csvName: "Sonora",              col: 1, row: 0 },
  { abbr: "CHH", csvName: "Chihuahua",           col: 2, row: 0 },
  { abbr: "COA", csvName: "Coahuila",            col: 3, row: 0 },
  { abbr: "NL",  csvName: "Nuevo León",          col: 4, row: 0 },
  { abbr: "TAM", csvName: "Tamaulipas",          col: 5, row: 0 },
  { abbr: "BCS", csvName: "Baja California Sur", col: 0, row: 1 },
  { abbr: "SIN", csvName: "Sinaloa",             col: 1, row: 1 },
  { abbr: "DUR", csvName: "Durango",             col: 2, row: 1 },
  { abbr: "ZAC", csvName: "Zacatecas",           col: 3, row: 1 },
  { abbr: "SLP", csvName: "San Luis Potosí",     col: 4, row: 1 },
  { abbr: "VER", csvName: "Veracruz",            col: 6, row: 1 },
  { abbr: "NAY", csvName: "Nayarit",             col: 1, row: 2 },
  { abbr: "JAL", csvName: "Jalisco",             col: 2, row: 2 },
  { abbr: "AGS", csvName: "Aguascalientes",      col: 3, row: 2 },
  { abbr: "GTO", csvName: "Guanajuato",          col: 4, row: 2 },
  { abbr: "QRO", csvName: "Querétaro",           col: 5, row: 2 },
  { abbr: "HGO", csvName: "Hidalgo",             col: 6, row: 2 },
  { abbr: "PUE", csvName: "Puebla",              col: 7, row: 2 },
  { abbr: "COL", csvName: "Colima",              col: 1, row: 3 },
  { abbr: "MIC", csvName: "Michoacán",           col: 2, row: 3 },
  { abbr: "MEX", csvName: "Estado de México",    col: 3, row: 3 },
  { abbr: "CDM", csvName: "Ciudad de México",    col: 4, row: 3 },
  { abbr: "TLX", csvName: "Tlaxcala",            col: 5, row: 3 },
  { abbr: "TAB", csvName: "Tabasco",             col: 6, row: 3 },
  { abbr: "CAM", csvName: "Campeche",            col: 7, row: 3 },
  { abbr: "YUC", csvName: "Yucatán",             col: 8, row: 3 },
  { abbr: "GRO", csvName: "Guerrero",            col: 2, row: 4 },
  { abbr: "MOR", csvName: "Morelos",             col: 3, row: 4 },
  { abbr: "OAX", csvName: "Oaxaca",              col: 4, row: 4 },
  { abbr: "CHS", csvName: "Chiapas",             col: 5, row: 4 },
  { abbr: "QTO", csvName: "Quintana Roo",        col: 8, row: 4 },
] as const;

function tileColor(sessions: number, maxSessions: number): string {
  if (!sessions || !maxSessions) return "#e5e5ea";
  const opacity = 0.12 + (sessions / maxSessions) * 0.88;
  return `rgba(0, 113, 227, ${opacity.toFixed(3)})`;
}

function fmtSessions(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ── Mexico schematic tile map ─────────────────────────────────────────── */
interface TileMapData { sessions: number; bounceRate: number; avgDurSec: number }

function MexicoTileMap({
  stateData, maxSessions,
}: {
  stateData:   Record<string, TileMapData>;
  maxSessions: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative">
      {/* Tooltip */}
      {hovered && (() => {
        const tile = MX_TILES.find(t => t.abbr === hovered);
        if (!tile) return null;
        const d = stateData[tile.csvName];
        if (!d || !d.sessions) return null;
        return (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-black/6 px-3 py-1.5 text-center pointer-events-none whitespace-nowrap">
            <p className="text-[11px] font-semibold text-[#1d1d1f]">{tile.csvName}</p>
            <p className="text-[10px] text-[#6e6e73]">
              {fmtSessions(d.sessions)} sessions · {d.bounceRate.toFixed(0)}% bounce · {formatDuration(d.avgDurSec)}
            </p>
          </div>
        );
      })()}

      {/* 9 × 5 CSS grid */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(9, 1fr)",
          gridTemplateRows:    "repeat(5, 1fr)",
          gap:                 "4px",
          aspectRatio:         "9 / 5",
          width:               "100%",
        }}
      >
        {MX_TILES.map(tile => {
          const data     = stateData[tile.csvName];
          const sessions = data?.sessions ?? 0;
          const bg       = tileColor(sessions, maxSessions);
          const textCol  = sessions > maxSessions * 0.38 ? "#fff" : "#636366";

          return (
            <div
              key={tile.abbr}
              onMouseEnter={() => setHovered(tile.abbr)}
              onMouseLeave={() => setHovered(null)}
              style={{
                gridColumn:     tile.col + 1,
                gridRow:        tile.row + 1,
                background:     bg,
                borderRadius:   "6px",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                transition:     "transform 0.14s, opacity 0.14s",
                transform:      hovered === tile.abbr && sessions ? "scale(1.14)" : "scale(1)",
                zIndex:         hovered === tile.abbr ? 10 : 1,
                position:       "relative",
                cursor:         sessions ? "default" : "default",
              }}
            >
              <span style={{ fontSize: "clamp(6px, 0.9vw, 9px)", fontWeight: 700, color: textCol, userSelect: "none" }}>
                {tile.abbr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scale legend */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-[#6e6e73]">Low</span>
        <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, #e5e5ea, rgba(0,113,227,0.3), #0071e3)" }} />
        <span className="text-[10px] text-[#6e6e73]">High</span>
      </div>
    </div>
  );
}

/* ── Sankey custom renderers ───────────────────────────────────────────── */
function SankeyNodeEl(props: any) {
  const { x, y, width, height, payload } = props;
  const name   = String(payload?.name ?? "");
  const depth  = payload?.depth ?? 0;
  const isExit = name === "/exit";

  const fill = depth === 0
    ? "#0071e3"           // Sources — Apple Blue
    : depth === 1
    ? "#34aadc"           // Landing pages — Teal
    : isExit
    ? "#ff6b35"           // Exit — Warm orange
    : "#636366";          // Other dropoff — Gray

  const isRight   = depth >= 2;
  const labelX    = isRight ? x - 7 : x + width + 7;
  const anchor    = isRight ? "end" : "start";
  const maxLen    = 13;
  const label     = name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;

  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 6)} rx={4} fill={fill} />
      <text x={labelX} y={y + Math.max(height, 6) / 2 + 3.5}
        textAnchor={anchor} fontSize={10} fill="#6e6e73"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

function SankeyLinkEl(props: any) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth } = props;
  const hw = linkWidth / 2;
  return (
    <path
      d={`M ${sourceX},${sourceY - hw}
          C ${sourceControlX},${sourceY - hw} ${targetControlX},${targetY - hw} ${targetX},${targetY - hw}
          L ${targetX},${targetY + hw}
          C ${targetControlX},${targetY + hw} ${sourceControlX},${sourceY + hw} ${sourceX},${sourceY + hw}
          Z`}
      fill="#0071e3"
      fillOpacity={0.12}
      strokeWidth={0}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────────────────── */
export function WebAnalyticsDashboard() {
  const [rawData,      setRawData]      = useState<WebRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState("overview");

  /* Filters */
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [selDevice,    setSelDevice]    = useState("All");
  const [selBrowser,   setSelBrowser]   = useState("All");
  const [selLanding,   setSelLanding]   = useState("All");

  /* ── Load CSV ────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch("/data/web_analytics_data.csv")
      .then(r => r.text())
      .then(text => {
        const parsed = Papa.parse<WebRow>(text, {
          header:       true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        setRawData(parsed.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ── Filtered data ───────────────────────────────────────────────────── */
  const filteredData = useMemo(() =>
    rawData.filter(r => {
      const dOk  = (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo);
      const dvOk = selDevice  === "All" || r.device       === selDevice;
      const bOk  = selBrowser === "All" || r.browser      === selBrowser;
      const lOk  = selLanding === "All" || r.landing_page === selLanding;
      return dOk && dvOk && bOk && lOk;
    }),
    [rawData, dateFrom, dateTo, selDevice, selBrowser, selLanding]
  );

  /* ── KPIs ────────────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    if (!filteredData.length) return null;
    const total   = filteredData.reduce((s, r) => s + r.sessions, 0);
    const bounce  = filteredData.reduce((s, r) => s + r.bounce_rate * r.sessions, 0) / (total || 1);
    const durSec  = filteredData.reduce((s, r) => s + r.avg_duration_sec * r.sessions, 0) / (total || 1);
    const convSes = filteredData.filter(r => r.landing_page === "/contacto" || r.dropoff_page === "/contacto")
                                .reduce((s, r) => s + r.sessions, 0);
    const convRate = (convSes / (total || 1)) * 100;

    /* Period-over-period delta (first half vs second half) */
    const mid   = Math.floor(filteredData.length / 2);
    const half1 = filteredData.slice(0, mid).reduce((s, r) => s + r.sessions, 0);
    const half2 = filteredData.slice(mid).reduce((s, r) => s + r.sessions, 0);
    const deltaPct = half1 > 0 ? (((half2 - half1) / half1) * 100).toFixed(1) : null;

    return { total, bounce: bounce * 100, durSec, convRate, deltaPct };
  }, [filteredData]);

  /* ── Weekly trend (Overview tab) ────────────────────────────────────── */
  const weeklyTrend = useMemo(() => {
    const map: Record<string, { sessions: number; bounceSum: number }> = {};
    filteredData.forEach(r => {
      const wk = weekLabel(r.date);
      if (!map[wk]) map[wk] = { sessions: 0, bounceSum: 0 };
      map[wk].sessions  += r.sessions;
      map[wk].bounceSum += r.bounce_rate * r.sessions;
    });
    return Object.entries(map).map(([week, d]) => ({
      week,
      sessions:   d.sessions,
      bounceRate: parseFloat(((d.bounceSum / (d.sessions || 1)) * 100).toFixed(1)),
    }));
  }, [filteredData]);

  /* ── Traffic sources ─────────────────────────────────────────────────── */
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(r => { map[r.source] = (map[r.source] || 0) + r.sessions; });
    return Object.entries(map)
      .map(([source, sessions]) => ({ source, sessions }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [filteredData]);

  /* ── Top landing + dropoff pages ────────────────────────────────────── */
  const landingData = useMemo(() => {
    const map: Record<string, { sessions: number; bounce: number; bSum: number }> = {};
    filteredData.forEach(r => {
      if (!map[r.landing_page]) map[r.landing_page] = { sessions: 0, bounce: 0, bSum: 0 };
      map[r.landing_page].sessions += r.sessions;
      map[r.landing_page].bSum     += r.bounce_rate * r.sessions;
    });
    return Object.entries(map)
      .map(([page, d]) => ({
        page,
        sessions:   d.sessions,
        bounceRate: parseFloat(((d.bSum / d.sessions) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [filteredData]);

  const dropoffData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(r => { map[r.dropoff_page] = (map[r.dropoff_page] || 0) + r.sessions; });
    return Object.entries(map)
      .map(([page, sessions]) => ({ page, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [filteredData]);

  /* ── Device & Browser ────────────────────────────────────────────────── */
  const deviceData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(r => { map[r.device] = (map[r.device] || 0) + r.sessions; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const browserData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(r => { map[r.browser] = (map[r.browser] || 0) + r.sessions; });
    return Object.entries(map)
      .map(([browser, sessions]) => ({ browser, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 6);
  }, [filteredData]);

  /* ── State / regional data ───────────────────────────────────────────── */
  const stateData = useMemo(() => {
    const map: Record<string, { sessions: number; bounceSum: number; durSum: number }> = {};
    filteredData.forEach(r => {
      if (!map[r.state_mx]) map[r.state_mx] = { sessions: 0, bounceSum: 0, durSum: 0 };
      map[r.state_mx].sessions  += r.sessions;
      map[r.state_mx].bounceSum += r.bounce_rate * r.sessions;
      map[r.state_mx].durSum    += r.avg_duration_sec * r.sessions;
    });
    return Object.fromEntries(
      Object.entries(map).map(([state, d]) => [
        state,
        {
          sessions:   d.sessions,
          bounceRate: (d.bounceSum / (d.sessions || 1)) * 100,
          avgDurSec:  d.durSum    / (d.sessions || 1),
        },
      ])
    ) as Record<string, TileMapData>;
  }, [filteredData]);

  const maxStateSessions = useMemo(
    () => Math.max(1, ...Object.values(stateData).map(d => d.sessions)),
    [stateData]
  );

  const topRegions = useMemo(
    () => Object.entries(stateData)
      .sort((a, b) => b[1].sessions - a[1].sessions)
      .slice(0, 5)
      .map(([state, d]) => ({ state, ...d })),
    [stateData]
  );

  /* ── Sankey navigation flow ───────────────────────────────────────────── */
  const sankeyData = useMemo(() => {
    if (!filteredData.length) return { nodes: [] as { name: string }[], links: [] as { source: number; target: number; value: number }[] };

    type FM = Record<string, Record<string, number>>;
    const s2l: FM = {};
    const l2d: FM = {};

    filteredData.forEach(r => {
      if (!s2l[r.source])       s2l[r.source] = {};
      s2l[r.source][r.landing_page] = (s2l[r.source][r.landing_page] || 0) + r.sessions;

      if (!l2d[r.landing_page]) l2d[r.landing_page] = {};
      l2d[r.landing_page][r.dropoff_page] = (l2d[r.landing_page][r.dropoff_page] || 0) + r.sessions;
    });

    const vol = (obj: Record<string, number>) => Object.values(obj).reduce((s, v) => s + v, 0);

    const topSrcs  = Object.entries(s2l).sort((a, b) => vol(b[1]) - vol(a[1])).slice(0, 5).map(e => e[0]);
    const topLands = Object.entries(l2d).sort((a, b) => vol(b[1]) - vol(a[1])).slice(0, 5).map(e => e[0]);
    const topLandsSet = new Set(topLands);
    // Exclude pages already in topLands to prevent duplicate nodes and semantic
    // self-loops (e.g. /contacto appears as both landing and dropoff).
    const topDrops = Array.from(new Set(
      topLands.flatMap(land =>
        Object.entries(l2d[land] || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0])
      )
    ))
      .filter(p => !topLandsSet.has(p))
      .slice(0, 6);

    const nodes: { name: string }[] = [
      ...topSrcs.map(n  => ({ name: n })),
      ...topLands.map(n => ({ name: n })),
      ...topDrops.map(n => ({ name: n })),
    ];

    const srcOff  = 0;
    const landOff = topSrcs.length;
    const dropOff = topSrcs.length + topLands.length;

    const links: { source: number; target: number; value: number }[] = [];

    topSrcs.forEach((src, si) => {
      topLands.forEach((land, li) => {
        const v = s2l[src]?.[land] ?? 0;
        if (v > 0) links.push({ source: srcOff + si, target: landOff + li, value: v });
      });
    });

    topLands.forEach((land, li) => {
      topDrops.forEach((drop, di) => {
        const v = l2d[land]?.[drop] ?? 0;
        if (v > 0) links.push({ source: landOff + li, target: dropOff + di, value: v });
      });
    });

    return { nodes, links: links.filter(l => l.source !== l.target) };
  }, [filteredData]);

  /* ── Filter option lists ─────────────────────────────────────────────── */
  const devices  = useMemo(() => ["All", ...Array.from(new Set(rawData.map(r => r.device)))],  [rawData]);
  const browsers = useMemo(() => ["All", ...Array.from(new Set(rawData.map(r => r.browser)))], [rawData]);
  const landings = useMemo(() => ["All", ...Array.from(new Set(rawData.map(r => r.landing_page)))], [rawData]);

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-3 text-[#6e6e73]">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading analytics data…</span>
      </div>
    );
  }

  /* ── Shared select style ─────────────────────────────────────────────── */
  const selectCls = cn(
    "rounded-full border border-[#e5e5ea] bg-[#f5f5f7]",
    "px-3 py-1.5 text-[0.8125rem] font-medium text-[#1d1d1f]",
    "focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30",
    "cursor-pointer appearance-none"
  );

  return (
    <div className="bg-white dark:bg-[#0a0a0a] min-h-screen">

      {/* Back ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#0071e3] transition-colors no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Projects
        </Link>
      </div>

      {/* Hero ─────────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-6 pt-8 pb-10">
        <FadeUp>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f5f5f7] dark:bg-[#1d1d1f] text-[11px] font-bold uppercase tracking-[0.09em] text-[#0071e3]">
            Data Analytics
          </span>
        </FadeUp>
        <FadeUp delay={0.07}>
          <h1 className="mt-5 text-[clamp(2rem,5.5vw,3.5rem)] font-bold tracking-[-0.04em] leading-[1.03] text-[#1d1d1f] dark:text-white">
            Web Analytics &amp; Behavior Dashboard
          </h1>
        </FadeUp>
        <FadeUp delay={0.13}>
          <p className="mt-3 text-[1.0625rem] text-[#6e6e73] dark:text-[#a1a1a6] max-w-xl leading-relaxed">
            Full-funnel user behavior analysis — tracking sessions, bounce rate,
            conversion paths, and device distribution across all traffic sources.
          </p>
        </FadeUp>
        <FadeUp delay={0.18}>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Python · Pandas", "Recharts", "Papa Parse", "Multi-filter", `${rawData.length.toLocaleString("en")} rows`]
              .map(tag => (
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

      {/* Filter bar ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-6">
        <FadeUp>
          <div className="rounded-3xl bg-[#f5f5f7] dark:bg-[#1d1d1f] px-6 py-4 flex flex-wrap items-center gap-3">
            <span className="text-[0.8125rem] font-semibold text-[#6e6e73] shrink-0">
              Filters
            </span>
            <input
              type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={selectCls}
              aria-label="Date from"
            />
            <span className="text-[#6e6e73] text-sm">→</span>
            <input
              type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={selectCls}
              aria-label="Date to"
            />
            <select value={selLanding}  onChange={e => setSelLanding(e.target.value)}  className={selectCls} aria-label="Landing page">
              {landings.map(v  => <option key={v}  value={v}>{v === "All" ? "All pages" : v}</option>)}
            </select>
            <select value={selDevice}   onChange={e => setSelDevice(e.target.value)}   className={selectCls} aria-label="Device">
              {devices.map(v  => <option key={v} value={v}>{v === "All" ? "All devices"  : v}</option>)}
            </select>
            <select value={selBrowser}  onChange={e => setSelBrowser(e.target.value)}  className={selectCls} aria-label="Browser">
              {browsers.map(v => <option key={v} value={v}>{v === "All" ? "All browsers" : v}</option>)}
            </select>
            {(dateFrom || dateTo || selDevice !== "All" || selBrowser !== "All" || selLanding !== "All") && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setSelDevice("All"); setSelBrowser("All"); setSelLanding("All"); }}
                className="px-3.5 py-1.5 rounded-full bg-white text-[0.8125rem] font-medium text-[#ff3b30] border border-[#e5e5ea] hover:bg-[#fff5f5] transition-colors"
              >
                Reset
              </button>
            )}
            <span className="ml-auto text-[0.75rem] text-[#6e6e73]">
              {filteredData.length.toLocaleString("en")} rows
            </span>
          </div>
        </FadeUp>
      </section>

      {/* KPI strip ──────────────────────────────────────────────────────── */}
      {kpis && (
        <section className="max-w-6xl mx-auto px-6 pb-8">
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StaggerItem>
              <KpiCard
                icon={Globe}
                label="Total Sessions"
                value={kpis.total.toLocaleString("en")}
                sub="Filtered period"
                delta={kpis.deltaPct ? `${kpis.deltaPct}%` : undefined}
                up={kpis.deltaPct ? parseFloat(kpis.deltaPct) >= 0 : undefined}
              />
            </StaggerItem>
            <StaggerItem>
              <KpiCard
                icon={MousePointerClick}
                label="Avg. Bounce Rate"
                value={`${kpis.bounce.toFixed(1)}%`}
                sub="Weighted by sessions"
                alert={kpis.bounce > 65}
              />
            </StaggerItem>
            <StaggerItem>
              <KpiCard
                icon={Timer}
                label="Avg. Session Duration"
                value={formatDuration(kpis.durSec)}
                sub="Across all devices"
              />
            </StaggerItem>
            <StaggerItem>
              <KpiCard
                icon={Layers}
                label="Conversion Rate"
                value={`${kpis.convRate.toFixed(2)}%`}
                sub="Sessions reaching /contacto"
                alert={kpis.convRate < 1.5}
              />
            </StaggerItem>
          </StaggerGrid>
        </section>
      )}

      {/* Tab nav ──────────────────────────────────────────────────────── */}
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

        {/* ── TAB: OVERVIEW ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="mt-5 space-y-5">

            {/* Weekly Traffic Trend */}
            <FadeUp>
              <SectionCard
                title="Weekly Traffic Trend"
                sub="Sessions (bars) and avg. bounce rate (line) · Filtered period"
              >
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={weeklyTrend} margin={{ top: 4, right: 28, left: -8, bottom: 0 }}>
                    <XAxis dataKey="week"  tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} width={52} />
                    <YAxis yAxisId="right" orientation="right"
                      tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false}
                      unit="%" width={36} domain={[0, 100]}
                    />
                    <Tooltip content={<GlassTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar  yAxisId="left"  dataKey="sessions"   name="Sessions"     fill={BLUE}      radius={[6,6,0,0]} fillOpacity={0.85} />
                    <Line yAxisId="right" dataKey="bounceRate" name="Bounce Rate %" stroke="#ff9f0a" strokeWidth={2} type="monotone" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap gap-5 pl-1">
                  <span className="flex items-center gap-2 text-[0.75rem] text-[#6e6e73]">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BLUE }} />Sessions
                  </span>
                  <span className="flex items-center gap-2 text-[0.75rem] text-[#6e6e73]">
                    <span className="inline-block w-5 h-0.5" style={{ background: "#ff9f0a" }} />Bounce Rate %
                  </span>
                </div>
              </SectionCard>
            </FadeUp>

            {/* ── 1. GEOGRAPHIC MAP & TOP REGIONS ──────────────────────── */}
            <FadeUp delay={0.05}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Left: Schematic tile map */}
                <div className="rounded-[2rem] p-7 sm:p-8 flex flex-col gap-5" style={{ background: BG_CARD }}>
                  <div>
                    <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">
                      Regional Heatmap — Mexico
                    </h3>
                    <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">
                      Color intensity = session volume · Hover for detail
                    </p>
                  </div>
                  <MexicoTileMap stateData={stateData} maxSessions={maxStateSessions} />
                </div>

                {/* Right: Top 5 regions list */}
                <div className="rounded-[2rem] p-7 sm:p-8 flex flex-col gap-4" style={{ background: BG_CARD }}>
                  <div>
                    <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">
                      Top Regions by Sessions
                    </h3>
                    <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">
                      States ranked by total session volume · Filtered period
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1">
                    {topRegions.map((r, i) => (
                      <div key={r.state}
                        className="flex items-center justify-between rounded-2xl bg-white dark:bg-[#2c2c2e] px-5 py-3.5"
                      >
                        {/* Rank + name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[0.6875rem] font-bold"
                            style={{ background: i === 0 ? BLUE : "#f5f5f7", color: i === 0 ? "#fff" : GRAY }}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.875rem] font-semibold text-[#1d1d1f] dark:text-white truncate">
                              {r.state}
                            </p>
                            <p className="text-[0.6875rem] text-[#6e6e73] mt-0.5">
                              {r.bounceRate.toFixed(0)}% bounce · {formatDuration(r.avgDurSec)}
                            </p>
                          </div>
                        </div>
                        {/* Sessions */}
                        <p className="text-[1rem] font-bold text-[#1d1d1f] dark:text-white shrink-0 ml-4">
                          {fmtSessions(r.sessions)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>

            {/* ── 2. NAVIGATION FLOW — SANKEY ──────────────────────────── */}
            <FadeUp delay={0.08}>
              <div className="rounded-[2rem] p-7 sm:p-8" style={{ background: BG_CARD }}>
                <div className="mb-6">
                  <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight">
                    User Navigation Flow: Source → Landing → Exit
                  </h3>
                  <p className="text-[0.8125rem] text-[#6e6e73] mt-0.5">
                    Traffic pathways through the site · Session-weighted node width
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {[
                      { color: "#0071e3", label: "Traffic sources" },
                      { color: "#34aadc", label: "Landing pages" },
                      { color: "#636366", label: "Exit pages" },
                      { color: "#ff6b35", label: "/exit node" },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[0.75rem] text-[#6e6e73]">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: l.color }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>

                {sankeyData.nodes.length > 0 ? (
                  <div className="overflow-x-auto" style={{ minHeight: 340 }}>
                    <ResponsiveContainer width="100%" height={340}>
                      <Sankey
                        data={sankeyData as any}
                        nodePadding={14}
                        nodeWidth={22}
                        node={SankeyNodeEl as any}
                        link={SankeyLinkEl as any}
                        margin={{ top: 10, right: 120, bottom: 10, left: 120 }}
                      >
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0]?.payload;
                            const isLink = p?.source !== undefined;
                            if (isLink) {
                              return (
                                <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-black/6 px-4 py-2.5">
                                  <p className="text-[12px] font-semibold text-[#1d1d1f]">
                                    {p.source?.name ?? "?"} → {p.target?.name ?? "?"}
                                  </p>
                                  <p className="text-[11px] text-[#6e6e73] mt-0.5">
                                    {(p.value ?? 0).toLocaleString("en")} sessions
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </Sankey>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[340px] flex items-center justify-center text-[#6e6e73] text-sm">
                    No flow data available for the current filter selection.
                  </div>
                )}
              </div>
            </FadeUp>

            {/* ── 3. KEY BEHAVIOR INSIGHTS ─────────────────────────────── */}
            <FadeUp delay={0.1}>
              <div className="rounded-[2rem] p-7 sm:p-8" style={{ background: BG_CARD }}>
                <h3 className="text-[1rem] font-semibold text-[#1d1d1f] tracking-tight mb-5">
                  Executive Analysis
                </h3>

                <div className="space-y-4">
                  {/* Insight 1 */}
                  <div className="flex gap-4 rounded-2xl bg-white dark:bg-[#2c2c2e] px-5 py-4">
                    <div className="w-9 h-9 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-[#0071e3]" />
                    </div>
                    <div>
                      <p className="text-[0.8125rem] font-bold text-[#1d1d1f] dark:text-white leading-snug">
                        Geographic Concentration
                      </p>
                      <p className="text-[0.8125rem] text-[#6e6e73] mt-1 leading-relaxed">
                        Mexico City accounts for the vast majority of active sessions (over 97K), maintaining a highly stable average session duration of ~2m 41s, indicating strong regional market penetration.
                      </p>
                    </div>
                  </div>

                  {/* Insight 2 */}
                  <div className="flex gap-4 rounded-2xl bg-white dark:bg-[#2c2c2e] px-5 py-4">
                    <div className="w-9 h-9 rounded-2xl bg-[#30d158]/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-[#30d158]" />
                    </div>
                    <div>
                      <p className="text-[0.8125rem] font-bold text-[#1d1d1f] dark:text-white leading-snug">
                        Organic Dominance
                      </p>
                      <p className="text-[0.8125rem] text-[#6e6e73] mt-1 leading-relaxed">
                        Organic search is the primary driver of top-of-funnel traffic, generating massive volume that primarily flows into <code className="text-[#0071e3] bg-[#f5f5f7] px-1 rounded">/contacto</code> and <code className="text-[#0071e3] bg-[#f5f5f7] px-1 rounded">/blog</code> landing pages.
                      </p>
                    </div>
                  </div>

                  {/* Insight 3 */}
                  <div className="flex gap-4 rounded-2xl bg-white dark:bg-[#2c2c2e] px-5 py-4">
                    <div className="w-9 h-9 rounded-2xl bg-[#ff9f0a]/10 flex items-center justify-center shrink-0">
                      <MousePointerClick className="w-4 h-4 text-[#ff9f0a]" />
                    </div>
                    <div>
                      <p className="text-[0.8125rem] font-bold text-[#1d1d1f] dark:text-white leading-snug">
                        Conversion Bottlenecks
                      </p>
                      <p className="text-[0.8125rem] text-[#6e6e73] mt-1 leading-relaxed">
                        A significant volume of CPC traffic drops off immediately at the <code className="text-[#0071e3] bg-[#f5f5f7] px-1 rounded">/servicios</code> and <code className="text-[#0071e3] bg-[#f5f5f7] px-1 rounded">/blog</code> nodes to <code className="text-[#ff6b35] bg-[#fff5f0] px-1 rounded">/exit</code>, signaling a critical opportunity for landing page optimization and AI-driven personalized retargeting.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeUp>

          </div>
        )}

        {/* ── TAB: TRAFFIC SOURCES ──────────────────────────────────────── */}
        {tab === "sources" && (
          <div className="mt-5">
            <FadeUp>
              <SectionCard
                title="Sessions by Traffic Source"
                sub="Horizontal breakdown of all acquisition channels"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={sourceData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="source" type="category" tick={{ fontSize: 11, fill: TEXT_DARK }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<GlassTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="sessions" name="Sessions" fill={BLUE} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Source data table */}
                <div className="mt-6 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-[0.6875rem] font-semibold text-[#6e6e73] uppercase tracking-[0.06em] px-4">
                    <span>Source</span><span className="text-right">Sessions</span><span className="text-right">Share</span>
                  </div>
                  {(() => {
                    const total = sourceData.reduce((a, x) => a + x.sessions, 0) || 1;
                    return sourceData.map(s => (
                      <div key={s.source} className="grid grid-cols-3 gap-2 items-center bg-white dark:bg-[#2c2c2e] rounded-2xl px-4 py-3">
                        <span className="text-[0.8125rem] font-semibold text-[#1d1d1f] dark:text-white">{s.source}</span>
                        <span className="text-[0.8125rem] text-right font-medium text-[#1d1d1f] dark:text-white">{s.sessions.toLocaleString("en")}</span>
                        <span className="text-right">
                          <span className="inline-block bg-[#0071e3]/10 text-[#0071e3] text-[0.75rem] font-bold px-2 py-0.5 rounded-full">
                            {((s.sessions / total) * 100).toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </SectionCard>
            </FadeUp>
          </div>
        )}

        {/* ── TAB: PAGES & FLOW ─────────────────────────────────────────── */}
        {tab === "pages" && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top entry pages */}
            <FadeUp>
              <SectionCard title="Top Entry Pages" sub="Sessions landing on each page">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={landingData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="page" type="category" tick={{ fontSize: 10, fill: TEXT_DARK }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<GlassTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="sessions" name="Sessions" fill={BLUE} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </FadeUp>

            {/* Top exit pages */}
            <FadeUp delay={0.06}>
              <SectionCard title="Top Exit Pages" sub="Pages where sessions ended">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={dropoffData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="page" type="category" tick={{ fontSize: 10, fill: TEXT_DARK }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<GlassTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="sessions" name="Sessions" fill="#5ac8fa" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </FadeUp>

            {/* Entry page detail table */}
            <FadeUp delay={0.1} className="lg:col-span-2">
              <SectionCard title="Entry Page Performance" sub="Sessions and bounce rate per landing page">
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-[0.6875rem] font-semibold text-[#6e6e73] uppercase tracking-[0.06em] px-4">
                    <span>Page</span>
                    <span className="text-right">Sessions</span>
                    <span className="text-right">Bounce Rate</span>
                  </div>
                  {landingData.slice(0, 6).map(p => (
                    <div key={p.page} className="grid grid-cols-3 gap-2 items-center bg-white dark:bg-[#2c2c2e] rounded-2xl px-4 py-3">
                      <span className="text-[0.8125rem] font-semibold text-[#1d1d1f] dark:text-white">{p.page}</span>
                      <span className="text-[0.8125rem] text-right font-medium text-[#1d1d1f] dark:text-white">{p.sessions.toLocaleString("en")}</span>
                      <span className="text-right">
                        <span
                          className={cn(
                            "inline-block text-[0.75rem] font-bold px-2 py-0.5 rounded-full",
                            p.bounceRate > 65
                              ? "bg-[#ff3b30]/10 text-[#ff3b30]"
                              : "bg-[#30d158]/10 text-[#30d158]"
                          )}
                        >
                          {p.bounceRate}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </FadeUp>
          </div>
        )}

        {/* ── TAB: DEVICES & BROWSERS ───────────────────────────────────── */}
        {tab === "devices" && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Device donut */}
            <FadeUp>
              <SectionCard title="Device Distribution" sub="Sessions split by device type">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {deviceData.map((_, i) => (
                        <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-2">
                  {deviceData.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-[0.75rem] text-[#6e6e73]">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                      {d.name}
                    </span>
                  ))}
                </div>
              </SectionCard>
            </FadeUp>

            {/* Browser bar chart */}
            <FadeUp delay={0.06}>
              <SectionCard title="Top Browsers" sub="Sessions per browser — top 6">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={browserData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="browser" type="category" tick={{ fontSize: 11, fill: TEXT_DARK }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<GlassTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="sessions" name="Sessions" radius={[0, 8, 8, 0]}>
                      {browserData.map((_, i) => (
                        <Cell key={i} fill={BROWSER_COLORS[i % BROWSER_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </FadeUp>

            {/* Device + browser stats */}
            <FadeUp delay={0.1} className="lg:col-span-2">
              <SectionCard title="Session Quality by Device" sub="Avg. duration and bounce rate per device type">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {deviceData.map((d, i) => {
                    const rows     = filteredData.filter(r => r.device === d.name);
                    const totalSes = rows.reduce((s, r) => s + r.sessions, 0);
                    const bounce   = rows.reduce((s, r) => s + r.bounce_rate * r.sessions, 0) / (totalSes || 1);
                    const dur      = rows.reduce((s, r) => s + r.avg_duration_sec * r.sessions, 0) / (totalSes || 1);
                    return (
                      <div key={d.name} className="rounded-2xl bg-white dark:bg-[#2c2c2e] p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                          <p className="text-[0.875rem] font-semibold text-[#1d1d1f] dark:text-white">{d.name}</p>
                        </div>
                        {[
                          { k: "Sessions",   v: totalSes.toLocaleString("en") },
                          { k: "Avg. Duration", v: formatDuration(dur)         },
                          { k: "Bounce Rate",   v: `${(bounce * 100).toFixed(1)}%` },
                        ].map(({ k, v }) => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-[0.75rem] text-[#6e6e73]">{k}</span>
                            <span className="text-[0.8125rem] font-semibold text-[#1d1d1f] dark:text-white">{v}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
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
