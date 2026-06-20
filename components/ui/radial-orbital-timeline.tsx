"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────── */
export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: LucideIcon;
  relatedIds: number[];
  status: "completed" | "in-progress" | "planned";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  className?: string;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const SVG_W       = 480;
const SVG_H       = 480;
const CX          = SVG_W / 2;          // 240
const CY          = SVG_H / 2;          // 240
const ORBIT_R     = 182;
const ITEM_BOX    = 62;                 // button bounding box (SVG units)
const CENTER_R    = 62;                 // center circle radius

/* ── Helpers ────────────────────────────────────────────────────────────── */
function itemAngle(index: number, total: number) {
  return -Math.PI / 2 + (index / total) * 2 * Math.PI;
}

function itemXY(index: number, total: number) {
  const a = itemAngle(index, total);
  return { x: CX + ORBIT_R * Math.cos(a), y: CY + ORBIT_R * Math.sin(a), a };
}

function toPercent(v: number, total: number) {
  return `${(v / total) * 100}%`;
}

type LabelSide = "top" | "right" | "bottom" | "left";

function labelSide(angle: number): LabelSide {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (Math.abs(cos) < 0.45) return sin < 0 ? "top" : "bottom";
  return cos > 0 ? "right" : "left";
}

/* ── Detail Panel ───────────────────────────────────────────────────────── */
function DetailPanel({
  item,
  allItems,
}: {
  item: TimelineItem;
  allItems: TimelineItem[];
}) {
  const Icon = item.icon;
  const related = allItems.filter((i) => item.relatedIds.includes(i.id));

  return (
    <div
      key={item.id}
      className={cn(
        "w-full rounded-[28px] p-6 space-y-5",
        "glass",
        "animate-fade-in"
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 glass-blue">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
              {item.category}
            </span>
            <span className="text-[10px] text-muted-foreground">· {item.date}</span>
          </div>
          <h3 className="text-base font-semibold text-foreground mt-0.5 leading-snug">
            {item.title}
          </h3>
        </div>
      </div>

      {/* ── Description ── */}
      <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>

      {/* ── Proficiency bar ── */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-foreground/50">Proficiency</span>
          <span className="text-xs font-bold text-primary">{item.energy}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-700"
            style={{ width: `${item.energy}%` }}
          />
        </div>
      </div>

      {/* ── Footer: status + related ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
            item.status === "completed"
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : item.status === "in-progress"
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              item.status === "completed"
                ? "bg-emerald-500"
                : item.status === "in-progress"
                ? "bg-primary animate-orbital-pulse"
                : "bg-muted-foreground"
            )}
          />
          {item.status === "completed"
            ? "Active"
            : item.status === "in-progress"
            ? "In Progress"
            : "Planned"}
        </span>

        {related.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => (
              <span
                key={r.id}
                className="px-2 py-0.5 rounded-full bg-foreground/6 text-foreground/45 text-[10px] font-medium border border-foreground/8"
              >
                {r.category}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export function RadialOrbitalTimeline({
  timelineData,
  className,
}: RadialOrbitalTimelineProps) {
  const [activeId, setActiveId] = useState<number>(timelineData[0]?.id ?? 1);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const focusId   = hoveredId ?? activeId;
  const focusItem = timelineData.find((i) => i.id === focusId) ?? timelineData[0];

  const getRelated = useCallback(
    (id: number) => {
      const item = timelineData.find((i) => i.id === id);
      return new Set([id, ...(item?.relatedIds ?? [])]);
    },
    [timelineData]
  );

  const highlighted = getRelated(focusId);

  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row items-center justify-center gap-6 xl:gap-10 w-full",
        className
      )}
    >
      {/* ── Orbital Canvas ─────────────────────────────────────────────── */}
      <div
        className="relative shrink-0 w-full"
        style={{ maxWidth: SVG_W, aspectRatio: "1 / 1" }}
      >
        {/* SVG: rings + connection lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            {/* Ambient glow gradient */}
            <radialGradient id="orb-ambient" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgb(0,122,255)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="rgb(0,122,255)" stopOpacity="0"    />
            </radialGradient>

            {/* Line glow filter */}
            <filter id="line-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ambient fill */}
          <circle cx={CX} cy={CY} r={ORBIT_R + 70} fill="url(#orb-ambient)" />

          {/* Decorative concentric rings */}
          {[40, 85, 135].map((r) => (
            <circle
              key={r}
              cx={CX} cy={CY} r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.045}
              strokeWidth={1}
            />
          ))}

          {/* Main orbital track */}
          <circle
            cx={CX} cy={CY} r={ORBIT_R}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.10}
            strokeWidth={1.5}
            className="orbital-ring-dashed"
          />

          {/* Connection lines between related items */}
          {timelineData.map((item) =>
            item.relatedIds
              .filter((rid) => rid > item.id)          // draw each pair once
              .map((rid) => {
                const from = itemXY(timelineData.findIndex((i) => i.id === item.id), timelineData.length);
                const toIdx = timelineData.findIndex((i) => i.id === rid);
                if (toIdx === -1) return null;
                const to = itemXY(toIdx, timelineData.length);
                const lit = highlighted.has(item.id) && highlighted.has(rid);

                return (
                  <line
                    key={`${item.id}-${rid}`}
                    x1={from.x} y1={from.y}
                    x2={to.x}   y2={to.y}
                    stroke={lit ? "rgb(0,122,255)" : "currentColor"}
                    strokeOpacity={lit ? 0.50 : 0.07}
                    strokeWidth={lit ? 1.5 : 1}
                    strokeDasharray={lit ? undefined : "3 7"}
                    filter={lit ? "url(#line-glow)" : undefined}
                    className="transition-all duration-300"
                  />
                );
              })
          )}

          {/* Active spoke: center → active item */}
          {(() => {
            const idx = timelineData.findIndex((i) => i.id === focusId);
            if (idx === -1) return null;
            const p = itemXY(idx, timelineData.length);
            return (
              <line
                x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke="rgb(0,122,255)"
                strokeOpacity={0.22}
                strokeWidth={1}
                strokeDasharray="3 5"
                className="transition-all duration-300"
              />
            );
          })()}
        </svg>

        {/* ── Center circle ── */}
        <div
          className="absolute z-10 flex flex-col items-center justify-center text-center rounded-full glass-orbital-center"
          style={{
            left:   toPercent(CX - CENTER_R, SVG_W),
            top:    toPercent(CY - CENTER_R, SVG_H),
            width:  toPercent(CENTER_R * 2, SVG_W),
            height: toPercent(CENTER_R * 2, SVG_H),
          }}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-primary leading-none">
            {focusItem?.category}
          </p>
          <p className="text-[8px] text-muted-foreground font-medium leading-none mt-1">
            {focusItem?.date}
          </p>
          {/* mini energy bar */}
          <div className="mt-2 w-10 h-0.5 rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${focusItem?.energy ?? 0}%` }}
            />
          </div>
        </div>

        {/* ── Orbital items ── */}
        {timelineData.map((item, idx) => {
          const { x, y, a } = itemXY(idx, timelineData.length);
          const Icon       = item.icon;
          const isActive   = activeId === item.id;
          const isHighlit  = highlighted.has(item.id);
          const side       = labelSide(a);

          return (
            <button
              key={item.id}
              className="absolute z-20 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                left:   toPercent(x - ITEM_BOX / 2, SVG_W),
                top:    toPercent(y - ITEM_BOX / 2, SVG_H),
                width:  toPercent(ITEM_BOX, SVG_W),
                height: toPercent(ITEM_BOX, SVG_H),
              }}
              onClick={() => setActiveId(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={item.title}
              aria-pressed={isActive}
            >
              {/* Ping ring */}
              {isActive && (
                <span className="absolute inset-0 rounded-full bg-primary/15 animate-orbital-ping pointer-events-none" />
              )}

              {/* Icon container */}
              <div
                className={cn(
                  "relative w-[82%] h-[82%] mx-auto my-auto rounded-[35%]",
                  "flex items-center justify-center",
                  "border transition-all duration-250",
                  "backdrop-blur-sm",
                  isActive
                    ? "bg-primary border-primary/50 glow-blue scale-110"
                    : isHighlit
                    ? "bg-primary/10 border-primary/35 scale-105 shadow-[0_0_12px_rgba(0,122,255,0.18)]"
                    : [
                        "bg-background/75 border-foreground/10",
                        "group-hover:border-primary/30 group-hover:scale-108",
                        "group-hover:shadow-[0_0_8px_rgba(0,122,255,0.12)]",
                      ].join(" ")
                )}
              >
                <Icon
                  className={cn(
                    "w-[38%] h-[38%] transition-colors duration-250",
                    isActive
                      ? "text-white"
                      : isHighlit
                      ? "text-primary"
                      : "text-foreground/55 group-hover:text-primary/80"
                  )}
                />

                {/* Status indicator */}
                <span
                  className={cn(
                    "absolute -top-[8%] -right-[8%] rounded-full border-2 border-background",
                    "w-[26%] h-[26%]",
                    item.status === "completed"
                      ? "bg-emerald-400"
                      : item.status === "in-progress"
                      ? "bg-primary animate-orbital-pulse"
                      : "bg-muted-foreground/50"
                  )}
                />
              </div>

              {/* Label — positioned outward from the center */}
              <span
                className={cn(
                  "absolute pointer-events-none select-none",
                  "text-[clamp(7px,1.4vw,10px)] font-semibold whitespace-nowrap leading-tight",
                  "transition-all duration-200",
                  isActive || isHighlit
                    ? "text-primary opacity-100"
                    : "text-foreground/40 opacity-80 group-hover:text-primary/70 group-hover:opacity-100",
                  side === "top"    && "bottom-full mb-1 left-1/2 -translate-x-1/2 text-center",
                  side === "bottom" && "top-full mt-1 left-1/2 -translate-x-1/2 text-center",
                  side === "right"  && "left-full ml-2 top-1/2 -translate-y-1/2 text-left",
                  side === "left"   && "right-full mr-2 top-1/2 -translate-y-1/2 text-right"
                )}
              >
                {item.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Detail Panel ───────────────────────────────────────────────── */}
      <div className="w-full lg:max-w-[300px] xl:max-w-sm shrink-0">
        <DetailPanel item={focusItem} allItems={timelineData} />
      </div>
    </div>
  );
}
