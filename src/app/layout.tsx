import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    default: "GitHub Automation Bot",
    template: "%s · GitHub Automation Bot",
  },
  description:
    "Event-driven GitHub automation — receive webhooks, run a rule engine, write back to GitHub, notify Slack, and observe it all from a secure dashboard.",
  applicationName: "GitHub Automation Bot",
  authors: [{ name: "github-automation-bot" }],
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          mono.variable,
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
