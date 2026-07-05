import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Aggregate counters + latencies powering the dashboard cards. */
export async function GET(): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const eventScope = { repository: { userId } };

  const [
    repositories,
    rules,
    events,
    processed,
    failed,
    skipped,
    pending,
    ghSuccess,
    ghFailed,
    slackSuccess,
    slackFailed,
    aiCount,
    eventAgg,
    ghAgg,
    slackAgg,
  ] = await prisma.$transaction([
    prisma.repository.count({ where: { userId } }),
    prisma.rule.count({ where: { userId } }),
    prisma.webhookEvent.count({ where: eventScope }),
    prisma.webhookEvent.count({ where: { ...eventScope, status: "PROCESSED" } }),
    prisma.webhookEvent.count({ where: { ...eventScope, status: "FAILED" } }),
    prisma.webhookEvent.count({ where: { ...eventScope, status: "SKIPPED" } }),
    prisma.webhookEvent.count({
      where: { ...eventScope, status: { in: ["RECEIVED", "PROCESSING"] } },
    }),
    prisma.gitHubAction.count({
      where: { webhookEvent: eventScope, status: "SUCCESS" },
    }),
    prisma.gitHubAction.count({
      where: { webhookEvent: eventScope, status: "FAILED" },
    }),
    prisma.slackDelivery.count({
      where: { webhookEvent: eventScope, status: "SUCCESS" },
    }),
    prisma.slackDelivery.count({
      where: { webhookEvent: eventScope, status: "FAILED" },
    }),
    prisma.aIAnalysis.count({ where: { webhookEvent: eventScope } }),
    prisma.webhookEvent.aggregate({
      where: { ...eventScope, processingMs: { not: null } },
      _avg: { processingMs: true },
    }),
    prisma.gitHubAction.aggregate({
      where: { webhookEvent: eventScope, latencyMs: { not: null } },
      _avg: { latencyMs: true },
    }),
    prisma.slackDelivery.aggregate({
      where: { webhookEvent: eventScope, latencyMs: { not: null } },
      _avg: { latencyMs: true },
    }),
  ]);

  const round = (n: number | null) => (n == null ? null : Math.round(n));

  return json({
    stats: {
      repositories,
      rules,
      events: {
        total: events,
        processed,
        failed,
        skipped,
        pending,
      },
      github: { success: ghSuccess, failed: ghFailed },
      slack: { success: slackSuccess, failed: slackFailed },
      ai: aiCount,
      latency: {
        processingMs: round(eventAgg._avg.processingMs),
        githubMs: round(ghAgg._avg.latencyMs),
        slackMs: round(slackAgg._avg.latencyMs),
      },
    },
  });
}
