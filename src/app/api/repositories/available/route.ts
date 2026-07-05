import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";
import { getUserAccessToken } from "@/lib/session";
import { listRepositories, GitHubError } from "@/lib/github";
import type { RepoSummary } from "@/types";

export const dynamic = "force-dynamic";

/** List repositories the user owns on GitHub, flagged if already connected. */
export async function GET(): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const token = await getUserAccessToken(userId);
  if (!token) {
    return apiError("GitHub token unavailable — please sign in again", 400);
  }

  try {
    const [repos, connected] = await Promise.all([
      listRepositories(token),
      prisma.repository.findMany({
        where: { userId },
        select: { fullName: true },
      }),
    ]);

    const connectedSet = new Set(connected.map((r) => r.fullName));
    const result: RepoSummary[] = repos.map((r) => ({
      ...r,
      alreadyConnected: connectedSet.has(r.fullName),
    }));

    return json({ repositories: result });
  } catch (err) {
    if (err instanceof GitHubError) {
      return apiError(`GitHub error: ${err.message}`, err.status);
    }
    return apiError("Failed to load repositories", 500);
  }
}
