/* Chart color roles. Values live in CSS custom properties so light/dark swap in one
 * place (next-themes toggles `.dark` on <html>). The prev/curr pair was validated for
 * color-vision deficiency on both surfaces (worst ΔE 27.7 light / 30.0 dark).
 *   light: prev #eb6834 · curr #0071e3   (surface #f5f5f7)
 *   dark:  prev #d95926 · curr #2997ff   (surface #1d1d1f)
 * Diverging pair (blue ↔ red, gray midpoint) validated the same way (ΔE 24.2 / 22.0). */
export const VIZ_VARS =
  "[--yt-prev:#eb6834] [--yt-curr:#0071e3] [--yt-grid:rgba(0,0,0,0.06)] [--yt-axis:#86868b] " +
  "[--yt-div-pos:#0071e3] [--yt-div-neg:#e34948] [--yt-div-mid:#e8e8ed] [--yt-div-mid-strong:#aeaeb2] [--yt-surface:#f5f5f7] " +
  "dark:[--yt-prev:#d95926] dark:[--yt-curr:#2997ff] dark:[--yt-grid:rgba(255,255,255,0.08)] dark:[--yt-axis:#8e8e93] " +
  "dark:[--yt-div-pos:#2997ff] dark:[--yt-div-neg:#e66767] dark:[--yt-div-mid:#3a3a3c] dark:[--yt-div-mid-strong:#636366] dark:[--yt-surface:#1d1d1f]";

export const SERIES = {
  prev: "var(--yt-prev)",
  curr: "var(--yt-curr)",
} as const;

export const AXIS_TICK = { fontSize: 11, fill: "var(--yt-axis)" } as const;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"] as const;
