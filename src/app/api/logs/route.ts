import { ActionStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Structured processing log feed (latency + status) for observability. */
export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const params = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const statusParam = params.get("status");
  const status =
    statusParam && statusParam in ActionStatus
      ? (statusParam as ActionStatus)
      : undefined;

  const where: Prisma.ActionLogWhereInput = {
    webhookEvent: { repository: { userId } },
    ...(status ? { status } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.actionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        webhookEvent: {
          select: {
            id: true,
            repoFullName: true,
            eventType: true,
            title: true,
            number: true,
          },
        },
      },
    }),
    prisma.actionLog.count({ where }),
  ]);

  return json({ logs, total, limit, offset });
}
