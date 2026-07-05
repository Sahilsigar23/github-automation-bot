import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Bot,
  Github,
  Bell,
  ListChecks,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateTime, formatMs, eventTypeLabel } from "@/lib/format";

export const metadata = { title: "Event detail" };

const PRIORITY_VARIANT: Record<
  string,
  "secondary" | "default" | "warning" | "destructive"
> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "warning",
  CRITICAL: "destructive",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const { id } = await params;

  const event = await prisma.webhookEvent.findFirst({
    where: { id, repository: { userId: session.user.id } },
    include: {
      aiAnalysis: true,
      actionLogs: { orderBy: { createdAt: "asc" } },
      githubActions: { orderBy: { createdAt: "asc" } },
      slackDeliveries: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!event) notFound();

  const payloadJson = JSON.stringify(event.payload, null, 2);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{eventTypeLabel(event.eventType)}</Badge>
          {event.action && <Badge variant="secondary">{event.action}</Badge>}
          {event.number && <span>#{event.number}</span>}
          <StatusBadge status={event.status} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {event.title ?? "(no title)"}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-mono">{event.repoFullName}</span>
          {event.senderLogin && <span>by @{event.senderLogin}</span>}
          {event.htmlUrl && (
            <a
              href={event.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              View on GitHub <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Timing */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetaCard label="Received" value={dateTime(event.receivedAt)} />
        <MetaCard
          label="Processed"
          value={event.processedAt ? dateTime(event.processedAt) : "—"}
        />
        <MetaCard label="Processing time" value={formatMs(event.processingMs)} />
      </div>

      {event.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span className="font-medium">Error:</span> {event.error}
        </div>
      )}

      {/* AI */}
      {event.aiAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" /> AI analysis
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {event.aiAnalysis.model} · {formatMs(event.aiAnalysis.latencyMs)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{event.aiAnalysis.summary}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Priority:</span>
              <Badge variant={PRIORITY_VARIANT[event.aiAnalysis.priority] ?? "outline"}>
                {event.aiAnalysis.priority}
              </Badge>
              {event.aiAnalysis.suggestedLabel && (
                <>
                  <span className="text-muted-foreground">Suggested label:</span>
                  <Badge variant="outline" className="font-mono">
                    {event.aiAnalysis.suggestedLabel}
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GitHub actions */}
      {event.githubActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Github className="h-4 w-4" /> GitHub actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.githubActions.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.actionType}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.target ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{a.retryCount}</TableCell>
                    <TableCell className="text-right">
                      {formatMs(a.latencyMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Slack */}
      {event.slackDeliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Slack deliveries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.slackDeliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {d.messageText}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell>{d.statusCode ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatMs(d.latencyMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Processing log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4" /> Processing log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {event.actionLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No log entries.</p>
          ) : (
            <ol className="space-y-3">
              {event.actionLogs.map((logEntry) => (
                <li key={logEntry.id} className="flex items-start gap-3">
                  <div className="w-24 shrink-0">
                    <StatusBadge status={logEntry.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{logEntry.step}</p>
                    {logEntry.message && (
                      <p className="text-sm text-muted-foreground">
                        {logEntry.message}
                      </p>
                    )}
                    {logEntry.errorMessage && (
                      <p className="text-xs text-destructive">
                        {logEntry.errorMessage}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatMs(logEntry.latencyMs)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Raw payload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw payload</CardTitle>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Show delivery {event.deliveryId}
            </summary>
            <pre className="mt-3 max-h-[400px] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs scrollbar-thin">
              {payloadJson}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}
