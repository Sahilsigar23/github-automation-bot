"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { usePolling } from "@/hooks/use-polling";
import { LIVE_REFRESH_MS } from "@/lib/constants";
import { EventsTable } from "@/components/dashboard/events-table";
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventsResponse, RepoItem } from "@/types/api";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "PROCESSED", label: "Processed" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "RECEIVED", label: "Received" },
  { value: "PROCESSING", label: "Processing" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "issues", label: "Issues" },
  { value: "pull_request", label: "Pull requests" },
  { value: "push", label: "Push" },
];

export function EventsView() {
  const [status, setStatus] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [repositoryId, setRepositoryId] = useState("all");
  const [offset, setOffset] = useState(0);
  const [repos, setRepos] = useState<RepoItem[]>([]);

  useEffect(() => {
    void fetch("/api/repositories", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { repositories: RepoItem[] }) => setRepos(d.repositories))
      .catch(() => undefined);
  }, []);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setOffset(0);
  }, [status, eventType, repositoryId]);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (status !== "all") params.set("status", status);
    if (eventType !== "all") params.set("eventType", eventType);
    if (repositoryId !== "all") params.set("repositoryId", repositoryId);
    return `/api/events?${params.toString()}`;
  }, [status, eventType, repositoryId, offset]);

  const { data, loading, error } = usePolling<EventsResponse>(
    url,
    LIVE_REFRESH_MS,
  );

  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Every webhook delivery, verified and processed.
          </p>
        </div>
        <LiveIndicator />
      </div>

      <div className="flex flex-wrap gap-2">
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
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {repos.length > 0 && (
          <Select value={repositoryId} onValueChange={setRepositoryId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repositories</SelectItem>
              {repos.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <EventsTable events={data?.events ?? []} />
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} event{total === 1 ? "" : "s"} · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
