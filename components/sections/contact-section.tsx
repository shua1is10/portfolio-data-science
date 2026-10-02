"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";

interface FormState {
  name:    string;
  email:   string;
  company: string;
  message: string;
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

const INITIAL: FormState = { name: "", email: "", company: "", message: "" };

export function ContactSection() {
  const [form,   setForm]   = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    form.name,
          email:   form.email,
          company: form.company || undefined,
          problem: form.message,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setForm(INITIAL);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const isLoading = status === "loading";
  const isDone    = status === "success";

  return (
    <section
      id="contact"
      className="relative py-28 px-6 overflow-hidden bg-background"
    >
      {/* ── Ambient glow ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center bottom, rgba(0,122,255,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,122,255,0.20), transparent)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* ── Section header ── */}
        <div className="text-center mb-12 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Get in touch
          </p>
          <h2 className="text-[clamp(1.8rem,4.5vw,3rem)] font-bold tracking-[-0.03em] leading-tight text-foreground">
            Let&apos;s Build Something
          </h2>
          <p className="text-muted-foreground text-[1.0625rem] leading-relaxed max-w-[440px] mx-auto">
            Have a data challenge or an AI idea? I&apos;d love to hear about it
            and explore how we can solve it together.
          </p>
        </div>

        {/* ── Glass card ── */}
        <div
          className={cn(
            "rounded-[32px] p-8 sm:p-10",
            "glass",
            "transition-all duration-500"
          )}
        >
          {isDone ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-foreground">
                  Message sent!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Thanks for reaching out. I&apos;ll get back to you soon.
                </p>
              </div>
              <Button
                variant="glass"
                size="sm"
                onClick={() => { setForm(INITIAL); setStatus("idle"); }}
              >
                Send another message
              </Button>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Name + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <Label htmlFor="company">
                  Company / Organization{" "}
                  <span className="text-muted-foreground/50 font-normal text-xs ml-1">
                    optional
                  </span>
                </Label>
                <Input
                  id="company"
                  name="company"
                  type="text"
                  placeholder="Where do you work?"
                  value={form.company}
                  onChange={handleChange}
                  disabled={isLoading}
                  autoComplete="organization"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="message">
                  What problem can I help you solve?
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Describe your challenge, idea, or project — the more context, the better."
                  value={form.message}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Submit */}
              <div className="pt-2 space-y-3">
                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={isLoading || !form.name || !form.email || !form.message}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                {status === "error" && (
                  <p className="text-[13px] text-red-400/80 leading-relaxed">
                    Something went wrong. Please try again or reach me directly at{" "}
                    <a
                      href="mailto:joshuaisan17o@gmail.com"
                      className="underline underline-offset-2 hover:text-red-300 transition-colors"
                    >
                      joshuaisan17o@gmail.com
                    </a>
                  </p>
                )}
              </div>

              {/* Footnote */}
              <p className="text-[11px] text-muted-foreground/40 leading-relaxed pt-1">
                I typically respond within 24 hours. Your information is never
                shared with third parties.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
