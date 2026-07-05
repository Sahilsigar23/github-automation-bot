import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { timeAgo, eventTypeLabel } from "@/lib/format";
import type { EventListItem } from "@/types/api";

type SubStatus = "SUCCESS" | "FAILED" | "PENDING" | null;

function deriveStatus(items: { status: string }[]): SubStatus {
  if (items.length === 0) return null;
  if (items.some((i) => i.status === "FAILED")) return "FAILED";
  if (items.some((i) => i.status === "SUCCESS")) return "SUCCESS";
  return "PENDING";
}

function SubCell({ status }: { status: SubStatus }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge status={status} />;
}

const PRIORITY_VARIANT: Record<
  string,
  "secondary" | "default" | "warning" | "destructive"
> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "warning",
  CRITICAL: "destructive",
};

export function EventsTable({ events }: { events: EventListItem[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No events yet. Send a test issue or pull request to a connected
        repository to see it appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead className="hidden lg:table-cell">Repository</TableHead>
            <TableHead>GitHub</TableHead>
            <TableHead>Slack</TableHead>
            <TableHead>AI</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="max-w-[280px]">
                <Link
                  href={`/events/${event.id}`}
                  className="group flex flex-col gap-0.5"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {eventTypeLabel(event.eventType)}
                    {event.action ? ` · ${event.action}` : ""}
                    {event.number ? ` · #${event.number}` : ""}
                  </span>
                  <span className="truncate font-medium group-hover:underline">
                    {event.title ?? "(no title)"}
                    <ArrowUpRight className="ml-0.5 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </Link>
              </TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                {event.repoFullName}
              </TableCell>
              <TableCell>
                <SubCell status={deriveStatus(event.githubActions)} />
              </TableCell>
              <TableCell>
                <SubCell status={deriveStatus(event.slackDeliveries)} />
              </TableCell>
              <TableCell>
                {event.aiAnalysis ? (
                  <Badge variant={PRIORITY_VARIANT[event.aiAnalysis.priority] ?? "outline"}>
                    {event.aiAnalysis.priority}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={event.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                {timeAgo(event.receivedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
