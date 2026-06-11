"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TAGS = ["AI Agents", "Predictive Models", "Workflow Automation", "Time Series", "Data Engineering"];

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  /* Subtle parallax on scroll */
  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const y = window.scrollY;
      el.style.setProperty("--scroll-y", `${y * 0.35}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      ref={containerRef}
      id="hero"
      className="relative min-h-[100svh] flex flex-col items-center justify-center text-center overflow-hidden px-6"
    >
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Blobs */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-60"
          style={{
            background: "radial-gradient(circle, rgba(0,122,255,0.09) 0%, transparent 70%)",
            transform: "translateY(var(--scroll-y, 0))",
            transition: "transform 0ms",
            animation: "blob-float 16s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(0,149,255,0.08) 0%, transparent 70%)",
            animation: "blob-float 20s ease-in-out infinite reverse",
            animationDelay: "-7s",
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-[300px] h-[300px] rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(0,122,255,0.06) 0%, transparent 70%)",
            animation: "blob-float 12s ease-in-out infinite",
            animationDelay: "-3s",
          }}
        />

        {/* Orbital ring decorations */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: "translateY(var(--scroll-y, 0))" }}
        >
          <div
            className="w-[640px] h-[640px] rounded-full border border-foreground/[0.035] animate-orbital-spin"
            style={{ borderStyle: "dashed" }}
          />
          <div className="absolute w-[900px] h-[900px] rounded-full border border-foreground/[0.025]" />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-6">

        {/* Greeting */}
        <p
          className={cn(
            "opacity-0 animate-fade-up",
            "text-[1.0625rem] font-medium tracking-[-0.01em]",
            "text-foreground/60"
          )}
        >
          Hi, I&apos;m Joshua Sánchez.
        </p>

        {/* Eyebrow badge */}
        <div
          className={cn(
            "opacity-0 animate-fade-up delay-100",
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full",
            "glass-blue text-primary text-xs font-bold uppercase tracking-[0.08em]"
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-orbital-pulse" />
          Data Science Engineer
        </div>

        {/* Headline */}
        <h1
          className={cn(
            "opacity-0 animate-fade-up delay-200",
            "text-[clamp(2.6rem,7.5vw,5.25rem)] font-bold leading-[1.03] tracking-[-0.04em]",
            "text-foreground"
          )}
        >
          Turning Data Into{" "}
          <span className="text-gradient-blue">
            Intelligent
          </span>{" "}
          Systems
        </h1>

        {/* Sub-headline */}
        <p
          className={cn(
            "opacity-0 animate-fade-up delay-300",
            "text-[clamp(1rem,2.4vw,1.1875rem)] text-muted-foreground leading-relaxed max-w-[560px]"
          )}
        >
          I design and deploy end-to-end AI solutions — from intelligent workflow
          automation and multi-agent pipelines to predictive models that drive
          real business decisions.
        </p>

        {/* CTA buttons */}
        <div className="opacity-0 animate-fade-up delay-400 flex flex-wrap items-center justify-center gap-3">
          <Button variant="default" size="lg" asChild>
            <a href="#skills">
              Explore My Stack
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
          <Button variant="glass" size="lg" asChild>
            <a href="mailto:joshuaisan17o@gmail.com">Get in touch</a>
          </Button>
        </div>

        {/* Tags row */}
        <div className="opacity-0 animate-fade-up delay-500 flex flex-wrap items-center justify-center gap-2 pt-2">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-foreground/5 text-foreground/45 border border-foreground/8",
                "hover:bg-primary/8 hover:text-primary hover:border-primary/20",
                "transition-colors duration-200 cursor-default"
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-0 animate-fade-in delay-600 flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50 font-medium">
          scroll
        </span>
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-foreground/20 to-transparent" />
      </div>
    </section>
  );
}
