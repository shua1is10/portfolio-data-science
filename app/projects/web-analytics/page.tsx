import type { Metadata } from "next";
import { WebAnalyticsDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Web Analytics & Behavior Dashboard — Joshua Sánchez",
  description:
    "Full-funnel user behavior analysis dashboard — tracking sessions, bounce rate, conversion paths, and device distribution across all traffic sources. Built with Recharts and Papa Parse.",
};

export default function WebAnalyticsPage() {
  return <WebAnalyticsDashboard />;
}
