import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "'JetBrains Mono'", "monospace"],
      },
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      keyframes: {
        "orbital-ping": {
          "0%":       { transform: "scale(1)",   opacity: "0.8" },
          "75%, 100%":{ transform: "scale(2.2)", opacity: "0"   },
        },
        "orbital-pulse": {
          "0%, 100%": { opacity: "1"   },
          "50%":      { opacity: "0.3" },
        },
        "orbital-spin": {
          from: { transform: "rotate(0deg)"   },
          to:   { transform: "rotate(360deg)" },
        },
        "gradient-flow": {
          "0%":   { backgroundPosition: "0% 50%"   },
          "50%":  { backgroundPosition: "100% 50%"  },
          "100%": { backgroundPosition: "0% 50%"   },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)"    },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "blob-float": {
          "0%, 100%": { transform: "translate(0,0)    scale(1)"    },
          "33%":      { transform: "translate(12px,-16px) scale(1.04)" },
          "66%":      { transform: "translate(-8px,8px) scale(0.97)"  },
        },
      },
      animation: {
        "orbital-ping":  "orbital-ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
        "orbital-pulse": "orbital-pulse 2.4s ease-in-out infinite",
        "orbital-spin":  "orbital-spin 50s linear infinite",
        "gradient-flow": "gradient-flow 5s ease infinite",
        "fade-up":       "fade-up 0.55s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
        "fade-in":       "fade-in 0.4s ease-out forwards",
        "blob-float":    "blob-float 14s ease-in-out infinite",
      },
      backgroundSize: {
        "200%": "200% 200%",
      },
    },
  },
  plugins: [],
};

export default config;
