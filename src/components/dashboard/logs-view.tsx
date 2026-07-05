"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { usePolling } from "@/hooks/use-polling";
import { LIVE_REFRESH_MS } from "@/lib/constants";
import { timeAgo, formatMs } from "@/lib/format";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LogItem } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "PENDING", label: "Pending" },
];

interface LogsResponse {
  logs: LogItem[];
  total: number;
}

export function LogsView() {
  const [status, setStatus] = useState("all");

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (status !== "all") params.set("status", status);
    return `/api/logs?${params.toString()}`;
  }, [status]);

  const { data, loading, error } = usePolling<LogsResponse>(
    url,
    LIVE_REFRESH_MS,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground">
            Structured, per-step processing log with latencies.
          </p>
        </div>
        <LiveIndicator />
      </div>

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.logs.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No log entries yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.logs ?? []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {timeAgo(log.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {log.step}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <Link
                      href={`/events/${log.webhookEvent.id}`}
                      className="truncate text-xs hover:underline"
                    >
                      <span className="block truncate font-medium">
                        {log.webhookEvent.title ?? log.webhookEvent.eventType}
                      </span>
                      <span className="block truncate font-mono text-muted-foreground">
                        {log.webhookEvent.repoFullName}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <span className="block truncate text-sm">
                      {log.message ?? "—"}
                    </span>
                    {log.errorMessage && (
                      <span className="block truncate text-xs text-destructive">
                        {log.errorMessage}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatMs(log.latencyMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
