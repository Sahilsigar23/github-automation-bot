import { ProcessingStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Paginated list of webhook events for the user's connected repositories. */
export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const params = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const statusParam = params.get("status");
  const status =
    statusParam && statusParam in ProcessingStatus
      ? (statusParam as ProcessingStatus)
      : undefined;
  const eventType = params.get("eventType") ?? undefined;
  const repositoryId = params.get("repositoryId") ?? undefined;

  const where: Prisma.WebhookEventWhereInput = {
    repository: { userId },
    ...(status ? { status } : {}),
    ...(eventType ? { eventType } : {}),
    ...(repositoryId ? { repositoryId } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        aiAnalysis: { select: { priority: true, summary: true } },
        githubActions: { select: { status: true } },
        slackDeliveries: { select: { status: true } },
        _count: { select: { actionLogs: true } },
      },
    }),
    prisma.webhookEvent.count({ where }),
  ]);

  return json({ events, total, limit, offset });
}
