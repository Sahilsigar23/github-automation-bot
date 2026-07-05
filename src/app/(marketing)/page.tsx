import Link from "next/link";
import {
  Github,
  Webhook,
  Zap,
  Bell,
  ShieldCheck,
  Bot,
  Activity,
  ArrowRight,
  GitPullRequest,
  Tag,
  RefreshCw,
  LayoutDashboard,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Github,
    title: "GitHub OAuth",
    body: "Sign in with GitHub. Access tokens are encrypted at rest and never touch the browser.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    body: "Every delivery is verified with HMAC-SHA256, de-duplicated by delivery id, and stored.",
  },
  {
    icon: Zap,
    title: "Rule engine",
    body: "Match issues & PRs by keyword and fire actions — no rules are hardcoded.",
  },
  {
    icon: Tag,
    title: "Write back to GitHub",
    body: "Auto-label issues (creating the label if missing) or post a templated comment.",
  },
  {
    icon: Bell,
    title: "Slack notifications",
    body: "Rich Block Kit messages with repo, author, actions performed and AI insights.",
  },
  {
    icon: Bot,
    title: "AI triage",
    body: "Gemini summarises each issue/PR and suggests a priority + label. Results are cached.",
  },
  {
    icon: RefreshCw,
    title: "Retry-safe",
    body: "Slack or GitHub failures are recorded with status & retry count — nothing is lost.",
  },
  {
    icon: Activity,
    title: "Observable",
    body: "Structured logs and per-step latencies for webhook, GitHub and Slack calls.",
  },
];

const FLOW = [
  { icon: GitPullRequest, label: "GitHub event" },
  { icon: Webhook, label: "Verify & store" },
  { icon: Zap, label: "Rule engine" },
  { icon: Tag, label: "Act + notify" },
];

export default async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Webhook className="h-5 w-5" />
            </div>
            <span>GitHub Automation Bot</span>
          </div>
          <Button asChild variant={signedIn ? "default" : "outline"}>
            <Link href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? "Open dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="container flex flex-col items-center py-20 text-center md:py-28">
          <Badge variant="secondary" className="mb-6 gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Event-driven · Production-ready
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Automate your GitHub workflow, end to end.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Connect a repository and this bot verifies every webhook, runs your
            rules, labels and comments on GitHub, pings Slack, and enriches each
            event with AI — all visible from one secure dashboard.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href={signedIn ? "/dashboard" : "/login"}>
                <Github className="h-4 w-4" />
                {signedIn ? "Open dashboard" : "Get started with GitHub"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link href="#features">
                See features <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Flow */}
          <div className="mt-16 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3">
            {FLOW.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-5 py-4 shadow-sm">
                  <step.icon className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t bg-muted/30 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Everything wired together
              </h2>
              <p className="mt-3 text-muted-foreground">
                A complete pipeline — not a demo. Duplicate protection, retries,
                encryption and observability are built in.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="container py-20">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">
                Secure by default
              </h2>
              <p className="mt-4 text-muted-foreground">
                Secrets live only in environment variables and are AES-256-GCM
                encrypted at rest. Webhook signatures are verified in constant
                time, inputs are validated with Zod, and the webhook endpoint is
                rate-limited. Tokens are never exposed to the frontend.
              </p>
            </div>
            <ul className="grid gap-3">
              {[
                "HMAC-SHA256 webhook verification",
                "AES-256-GCM encrypted tokens",
                "Zod input validation everywhere",
                "Secure, HTTP-only session cookies",
                "Rate limiting on webhook ingestion",
                "No secrets committed to the repo",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/30 py-20">
          <div className="container flex flex-col items-center text-center">
            <LayoutDashboard className="h-10 w-10 text-primary" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Ready in minutes
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Sign in with GitHub, connect a repo, add a rule, and send yourself
              a test issue titled “bug”. Watch it get labelled and posted to
              Slack in real time.
            </p>
            <Button asChild size="lg" className="mt-8 gap-2">
              <Link href={signedIn ? "/dashboard" : "/login"}>
                <Github className="h-4 w-4" />
                {signedIn ? "Open dashboard" : "Start now"}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>Built with Next.js 15, Prisma, NextAuth & Tailwind.</p>
          <p>MIT Licensed</p>
        </div>
      </footer>
    </div>
  );
}
