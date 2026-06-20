import type { Metadata } from "next";
import { readFileSync } from "fs";
import path from "path";
import { InsightsDashboard, type DashboardData } from "./charts";

export const metadata: Metadata = {
  title: "Global Digital Addiction Analysis — Joshua Sánchez",
  description:
    "Interactive data science dashboard: predictive modeling of digital addiction, attention span erosion, and mental health risk across 100 countries from 2015 to 2060.",
};

export default function DigitalAddictionPage() {
  const raw  = readFileSync(
    path.join(process.cwd(), "public", "data_insights.json"),
    "utf-8"
  );
  const data = JSON.parse(raw) as DashboardData;

  return <InsightsDashboard data={data} />;
}
