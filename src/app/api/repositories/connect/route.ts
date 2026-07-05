import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";
import { getUserAccessToken } from "@/lib/session";
import { connectRepoSchema } from "@/lib/validations";
import { env, webhookUrl } from "@/lib/env";
import {
  getRepository,
  createWebhook,
  splitFullName,
  GitHubError,
} from "@/lib/github";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
const log = createLogger("repositories.connect");

/** Connect a repository: verify access, persist it, auto-register a webhook. */
export async function POST(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const token = await getUserAccessToken(userId);
  if (!token) {
    return apiError("GitHub token unavailable — please sign in again", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = connectRepoSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid repository", 422, {
      issues: parsed.error.flatten(),
    });
  }

  const { owner, repo } = splitFullName(parsed.data.fullName);

  // Confirm the user actually has access, and fetch canonical details.
  let details;
  try {
    details = await getRepository(token, owner, repo);
  } catch (err) {
    if (err instanceof GitHubError) {
      return apiError(`Cannot access repository: ${err.message}`, err.status);
    }
    return apiError("Failed to reach GitHub", 502);
  }

  // Best-effort webhook auto-registration.
  let webhookId: bigint | null = null;
  let webhookActive = false;
  let warning: string | null = null;

  if (env.GITHUB_WEBHOOK_SECRET) {
    try {
      const hook = await createWebhook(
        token,
        owner,
        repo,
        webhookUrl(),
        env.GITHUB_WEBHOOK_SECRET,
      );
      webhookId = BigInt(hook.id);
      webhookActive = hook.active;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("Auto webhook registration failed", { repo: details.fullName, message });
      warning =
        "Repository connected, but automatic webhook registration failed " +
        "(this is expected on localhost). Add the webhook manually — see the " +
        "Settings page for the URL and secret.";
    }
  } else {
    warning =
      "GITHUB_WEBHOOK_SECRET is not set, so no webhook was registered. " +
      "Configure it and add the webhook manually.";
  }

  try {
    const repository = await prisma.repository.create({
      data: {
        userId,
        githubId: BigInt(details.githubId),
        name: details.name,
        fullName: details.fullName,
        owner: details.owner,
        private: details.private,
        htmlUrl: details.htmlUrl,
        defaultBranch: details.defaultBranch,
        webhookId,
        webhookActive,
      },
      include: { _count: { select: { rules: true, events: true } } },
    });

    return json({ repository, warning }, 201);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.repository.findUnique({
        where: { fullName: details.fullName },
        select: { userId: true },
      });
      if (existing?.userId === userId) {
        return apiError("Repository is already connected", 409);
      }
      return apiError(
        "This repository is already connected by another account",
        409,
      );
    }
    log.error("Failed to persist repository", {
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Failed to connect repository", 500);
  }
}
