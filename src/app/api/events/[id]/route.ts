import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Full detail for a single webhook event, including all processing records. */
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;

  const event = await prisma.webhookEvent.findFirst({
    where: { id, repository: { userId } },
    include: {
      repository: { select: { fullName: true, htmlUrl: true } },
      aiAnalysis: true,
      actionLogs: { orderBy: { createdAt: "asc" } },
      githubActions: { orderBy: { createdAt: "asc" } },
      slackDeliveries: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!event) return apiError("Event not found", 404);
  return json({ event });
}
