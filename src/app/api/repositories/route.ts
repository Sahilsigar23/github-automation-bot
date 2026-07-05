import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";

export const dynamic = "force-dynamic";

/** List the current user's connected repositories with rule/event counts. */
export async function GET(): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const repositories = await prisma.repository.findMany({
    where: { userId },
    orderBy: { connectedAt: "desc" },
    include: {
      _count: { select: { rules: true, events: true } },
    },
  });

  return json({ repositories });
}
