"use client";

import Link from "next/link";
import {
  GitBranch,
  Zap,
  Inbox,
  AlertTriangle,
  Github,
  Bell,
  Bot,
  Timer,
  RefreshCw,
} from "lucide-react";

import { usePolling } from "@/hooks/use-polling";
import { LIVE_REFRESH_MS } from "@/lib/constants";
import { formatMs } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import { EventsTable } from "@/components/dashboard/events-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatsResponse, EventsResponse } from "@/types/api";

function HealthRow({
  label,
  icon: Icon,
  success,
  failed,
}: {
  label: string;
  icon: typeof Github;
  success: number;
  failed: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <span className="flex items-center gap-3 text-sm tabular-nums">
        <span className="text-success">{success} ok</span>
        <span className={failed > 0 ? "text-destructive" : "text-muted-foreground"}>
          {failed} failed
        </span>
      </span>
    </div>
  );
}

export function DashboardOverview() {
  const stats = usePolling<StatsResponse>("/api/stats", LIVE_REFRESH_MS);
  const recent = usePolling<EventsResponse>(
    "/api/events?limit=8",
    LIVE_REFRESH_MS,
  );

  const s = stats.data?.stats;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time view of your automation pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void stats.refresh();
              void recent.refresh();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {stats.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {stats.error}
        </div>
      )}

      {/* Primary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!s ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] w-full" />
          ))
        ) : (
          <>
            <StatCard label="Repositories" value={s.repositories} icon={GitBranch} />
            <StatCard label="Rules" value={s.rules} icon={Zap} />
            <StatCard
              label="Events"
              value={s.events.total}
              icon={Inbox}
              hint={`${s.events.processed} processed · ${s.events.pending} pending`}
            />
            <StatCard
              label="Failed events"
              value={s.events.failed}
              icon={AlertTriangle}
              accentClassName={
                s.events.failed > 0
                  ? "bg-destructive/10 text-destructive"
                  : undefined
              }
              hint={s.events.failed > 0 ? "Needs attention" : "All healthy"}
            />
          </>
        )}
      </div>

      {/* Delivery health + latency */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Delivery health</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {!s ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : (
              <>
                <HealthRow
                  label="GitHub"
                  icon={Github}
                  success={s.github.success}
                  failed={s.github.failed}
                />
                <HealthRow
                  label="Slack"
                  icon={Bell}
                  success={s.slack.success}
                  failed={s.slack.failed}
                />
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    AI analyses
                  </span>
                  <span className="text-sm tabular-nums">{s.ai}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4" /> Avg latency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!s ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <LatencyRow label="Processing" ms={s.latency.processingMs} />
                <LatencyRow label="GitHub API" ms={s.latency.githubMs} />
                <LatencyRow label="Slack" ms={s.latency.slackMs} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent events */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent events</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/events">View all</Link>
          </Button>
        </div>
        {recent.loading && !recent.data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <EventsTable events={recent.data?.events ?? []} />
        )}
      </div>
    </div>
  );
}

function LatencyRow({ label, ms }: { label: string; ms: number | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatMs(ms)}</span>
    </div>
  );
}
