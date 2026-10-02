import { Github, Linkedin, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const SOCIAL = [
  {
    label: "LinkedIn",
    href:  "https://www.linkedin.com/in/joshua-ismael-s%C3%A1nchez-reyes-903abb270/?skipRedirect=true",
    icon:  Linkedin,
  },
  {
    label: "GitHub",
    href:  "https://github.com/shua1is10",
    icon:  Github,
  },
  {
    label: "Email",
    href:  "mailto:joshuaisan17o@gmail.com",
    icon:  Mail,
  },
];

const FOOTER_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Contact",  href: "/#contact"  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-foreground/8 bg-background">
      {/* Top accent line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,122,255,0.20), transparent)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">

          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center">
              <span className="font-semibold text-[1.0625rem] tracking-[-0.03em]">
                Joshua<span className="text-primary">.</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center md:text-left max-w-[220px] leading-relaxed">
              Data Science Engineer building intelligent AI systems.
            </p>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className={cn(
                  "text-sm text-muted-foreground hover:text-foreground",
                  "transition-colors duration-150 no-underline"
                )}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Social icons */}
          <div className="flex items-center gap-2">
            {SOCIAL.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-label={label}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center",
                  "glass border border-foreground/10",
                  "text-muted-foreground hover:text-primary",
                  "transition-all duration-200 hover:scale-110",
                  "hover:shadow-[0_0_12px_rgba(0,122,255,0.18)] hover:border-primary/25",
                  "no-underline"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-foreground/6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground/50" suppressHydrationWarning>
            © {new Date().getFullYear()} Joshua Ismael Sánchez Reyes. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40">
            Built with Next.js · Tailwind CSS · shadcn/ui
          </p>
        </div>
      </div>
    </footer>
  );
}
