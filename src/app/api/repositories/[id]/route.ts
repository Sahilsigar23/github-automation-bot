import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";
import { getUserAccessToken } from "@/lib/session";
import { deleteWebhook, splitFullName } from "@/lib/github";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
const log = createLogger("repositories.delete");

type Ctx = { params: Promise<{ id: string }> };

/** Disconnect a repository: remove its GitHub webhook, then delete it. */
export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;

  const repository = await prisma.repository.findUnique({ where: { id } });
  if (!repository || repository.userId !== userId) {
    return apiError("Repository not found", 404);
  }

  // Best-effort: remove the webhook we created on GitHub.
  if (repository.webhookId) {
    const token = await getUserAccessToken(userId);
    if (token) {
      try {
        const { owner, repo } = splitFullName(repository.fullName);
        await deleteWebhook(token, owner, repo, Number(repository.webhookId));
      } catch (err) {
        log.warn("Failed to delete GitHub webhook (continuing)", {
          repo: repository.fullName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await prisma.repository.delete({ where: { id } });
  return json({ success: true });
}
