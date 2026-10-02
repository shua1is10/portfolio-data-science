import type { Metadata } from "next";
import { loadSummary } from "../load-summary";
import { YouTubeDashboard } from "./youtube-dashboard";

export const metadata: Metadata = {
  title: "YouTube Topic Intelligence · Dashboard — Joshua Sánchez",
  description:
    "Interactive dashboard: year-over-year publishing volume, engagement efficiency by video length, subtopic share and the sentiment × performance matrix.",
};

/** Server shell: the small executive summary is read at build time; the video-level
 *  rows (public/data/youtube-topic-intelligence/videos.json) load in the browser so the
 *  filters can recompute every chart without a round trip. */
export default function YouTubeDashboardPage() {
  const summary = loadSummary();
  return <YouTubeDashboard meta={summary.meta} maturityDays={summary.thresholds.maturity_days} />;
}
