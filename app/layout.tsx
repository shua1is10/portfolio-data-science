import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers }  from "@/components/providers";
import { Navbar }     from "@/components/navbar";
import { Footer }     from "@/components/footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Joshua Sánchez — Data Science Engineer",
  description:
    "Data Science Engineer specializing in AI agents, predictive models, and workflow automation. Building intelligent systems that turn complex data into real impact.",
  keywords: ["Data Science", "AI", "Machine Learning", "Data Engineer", "Joshua Sánchez"],
  authors: [{ name: "Joshua Ismael Sánchez Reyes" }],
  openGraph: {
    title: "Joshua Sánchez — Data Science Engineer",
    description: "Building intelligent systems at the intersection of AI and data.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased">
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 pt-[58px]">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
