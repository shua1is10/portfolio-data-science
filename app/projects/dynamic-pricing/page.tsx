import type { Metadata } from "next";
import { DynamicPricingDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Dynamic Pricing Dashboard — Joshua Sánchez",
  description:
    "ML-powered live dashboard for mobile retail price forecasting. 48-hour rolling predictions, competitor analysis, and feature importance — built with Python, scikit-learn, and Recharts.",
};

export default function DynamicPricingPage() {
  return <DynamicPricingDashboard />;
}
