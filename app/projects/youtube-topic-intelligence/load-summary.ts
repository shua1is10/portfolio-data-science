import { readFileSync } from "fs";
import path from "path";
import type { InsightsSummary } from "./types";

/** Reads the pipeline's executive summary at build time (server only). Unlike the
 *  football dashboard's tolerant loaders, a missing file fails the build on purpose:
 *  every section of the case study is derived from it, so there is no useful fallback. */
export function loadSummary(): InsightsSummary {
  const file = path.join(process.cwd(), "data", "youtube-topic-intelligence", "insights_summary.json");
  return JSON.parse(readFileSync(file, "utf-8")) as InsightsSummary;
}
