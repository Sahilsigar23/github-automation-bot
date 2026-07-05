import { formatDistanceToNow, format } from "date-fns";

/** "3 minutes ago" — for tables and feeds. */
export function timeAgo(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatDistanceToNow(date, { addSuffix: true });
}

/** "Jul 5, 2026 14:03:22" — for detail views. */
export function dateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return format(date, "MMM d, yyyy HH:mm:ss");
}

/** "812 ms" / "1.2 s" — human latency. */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const EVENT_LABEL: Record<string, string> = {
  issues: "Issue",
  pull_request: "Pull request",
  push: "Push",
};

export function eventTypeLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType;
}
