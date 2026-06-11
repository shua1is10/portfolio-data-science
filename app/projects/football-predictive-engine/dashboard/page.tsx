import type { Metadata } from "next";
import { existsSync, readFileSync } from "fs";
import path from "path";
import Papa from "papaparse";
import {
  EngineDashboard,
  type TrackedMatch, type FormEntry, type MatchInsight,
} from "./engine-dashboard";

export const metadata: Metadata = {
  title: "Forecast Dashboard — International Football Predictive Engine",
  description:
    "Live output of the predictive engine: round projections, prediction tracking against real results, and the dynamic team form index.",
};

/* Raw row shape as written by the Python engine (Spanish column names) */
interface RawTrackingRow {
  match_id:           string;
  fase:               string;
  equipo_A:           string;
  equipo_B:           string;
  prob_A:             number;
  prob_Empate:        number;
  prob_B:             number;
  prediccion_modelo:  string;
  resultado_real:     string;
  goles_A_real:       number | null;
  goles_B_real:       number | null;
  acierto_prediccion: string | null;
}

/** Tolerant loader for the generative-AI insights store. A missing file,
 *  malformed JSON, or an empty array all degrade to "no insights" — the UI
 *  renders its pending state instead of breaking. */
function loadInsights(root: string): MatchInsight[] {
  const file = path.join(root, "ai_match_insights.json");
  if (!existsSync(file)) return [];
  try {
    // Windows editors often save JSON with a UTF-8 BOM, which JSON.parse rejects
    const raw = readFileSync(file, "utf-8").replace(/^\\uFEFF/, "");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as MatchInsight[]) : [];
  } catch {
    return [];
  }
}

/** Reads the engine's own output files (tracking CSV + form JSON) at build
 *  time and normalizes them into English-labelled props for the client UI. */
function loadEngineOutput(): {
  matches: TrackedMatch[]; form: FormEntry[]; insights: MatchInsight[];
} {
  const root = process.cwd();

  const csv = readFileSync(path.join(root, "tracking_predicciones_2026.csv"), "utf-8");
  const parsed = Papa.parse<RawTrackingRow>(csv.trim(), {
    header: true,
    dynamicTyping: true,
  });

  const matches: TrackedMatch[] = parsed.data.map((r) => {
    const round = Number(/^J(\d)/.exec(r.match_id)?.[1] ?? 0);
    const group = r.match_id.split("-")[1] ?? "";
    const resolved = r.resultado_real !== "Pendiente";
    return {
      id:       r.match_id,
      round,
      group,
      teamA:    r.equipo_A,
      teamB:    r.equipo_B,
      probA:    r.prob_A,
      probDraw: r.prob_Empate,
      probB:    r.prob_B,
      predicted: r.prediccion_modelo === "Empate" ? "Draw" : r.prediccion_modelo,
      resolved,
      goalsA:   resolved ? Number(r.goles_A_real) : null,
      goalsB:   resolved ? Number(r.goles_B_real) : null,
      outcome:  !resolved
        ? null
        : r.resultado_real === "Empate"
          ? "Draw"
          : r.resultado_real === "Victoria A"
            ? r.equipo_A
            : r.equipo_B,
      correct:  resolved ? r.acierto_prediccion === "SI" : null,
    };
  });

  const formRaw = JSON.parse(
    readFileSync(path.join(root, "live_form_index.json"), "utf-8")
  ) as Record<string, number>;

  const form: FormEntry[] = Object.entries(formRaw)
    .map(([team, index]) => ({ team, index, deltaPct: (index - 1) * 100 }))
    .sort((a, b) => b.index - a.index);

  return { matches, form, insights: loadInsights(root) };
}

export default function EngineDashboardPage() {
  const { matches, form, insights } = loadEngineOutput();
  return <EngineDashboard matches={matches} form={form} insights={insights} />;
}
