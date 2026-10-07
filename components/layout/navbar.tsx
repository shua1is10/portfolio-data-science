"use client";

import { useEffect, useState } from "react";
import { useTheme }     from "next-themes";
import { usePathname }  from "next/navigation";
import Link             from "next/link";
import { Sun, Moon, Menu, X } from "lucide-react";
import { cn }     from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
];

export function Navbar() {
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();

  const [mounted,    setMounted]    = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "glass border-b border-foreground/8 shadow-[0_2px_20px_rgba(0,0,0,0.06)]"
            : "bg-transparent"
        )}
      >
        <nav className="max-w-6xl mx-auto px-6 h-[58px] flex items-center justify-between gap-4">

          {/* Logo — navigates to Home */}
          <Link
            href="/"
            className="flex items-center shrink-0 text-foreground no-underline group"
          >
            <span className="font-semibold text-[1.125rem] tracking-[-0.03em] transition-opacity duration-150 group-hover:opacity-75">
              Joshua<span className="text-primary">.</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium no-underline",
                    "transition-all duration-150",
                    isActive(href)
                      ? "text-foreground bg-foreground/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  "glass border border-foreground/10",
                  "transition-all duration-200",
                  "hover:scale-105 hover:shadow-[0_0_16px_rgba(0,122,255,0.18)]",
                  "active:scale-95"
                )}
              >
                {resolvedTheme === "dark" ? (
                  <Sun  className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-foreground/70" />
                )}
              </button>
            )}

            {/* CTA */}
            <Button
              variant="glass-blue"
              size="sm"
              className="hidden sm:inline-flex"
              asChild
            >
              <a href="mailto:joshuaisan17o@gmail.com">Get in touch</a>
            </Button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-10 h-10 rounded-full glass flex items-center justify-center"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen
                ? <X    className="w-4 h-4 text-foreground" />
                : <Menu className="w-4 h-4 text-foreground" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col pt-[58px]">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-xl"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative z-10 mx-4 mt-4 glass rounded-[24px] p-6 space-y-1">
            <Link
              href="/"
              className={cn(
                "block px-4 py-3 rounded-2xl text-base font-medium no-underline transition-colors",
                pathname === "/"
                  ? "text-foreground bg-foreground/8"
                  : "text-foreground hover:bg-foreground/5"
              )}
            >
              Home
            </Link>
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "block px-4 py-3 rounded-2xl text-base font-medium no-underline transition-colors",
                  isActive(href)
                    ? "text-foreground bg-foreground/8"
                    : "text-foreground hover:bg-foreground/5"
                )}
              >
                {label}
              </Link>
            ))}
            <div className="pt-2">
              <Button variant="default" className="w-full" asChild>
                <a href="mailto:joshuaisan17o@gmail.com">
                  Get in touch
                </a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
