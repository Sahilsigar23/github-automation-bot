import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { safeDecrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { MAX_RETRIES } from "@/lib/constants";
import * as github from "@/lib/github";
import { postSlackPayload } from "@/lib/slack";

const log = createLogger("retry");

export interface RetrySummary {
  githubRetried: number;
  githubSucceeded: number;
  slackRetried: number;
  slackSucceeded: number;
}

interface GhPayload {
  owner?: string;
  repo?: string;
  issueNumber?: number;
  labels?: string[];
  body?: string;
}

/**
 * Re-attempt failed GitHub actions and Slack deliveries that haven't exhausted
 * their retry budget. Called by the cron endpoint. Every attempt increments
 * retryCount so a permanently-broken action eventually stops being retried.
 */
export async function retryFailedActions(batchSize = 20): Promise<RetrySummary> {
  const summary: RetrySummary = {
    githubRetried: 0,
    githubSucceeded: 0,
    slackRetried: 0,
    slackSucceeded: 0,
  };

  // --- GitHub actions -------------------------------------------------------
  const failedGh = await prisma.gitHubAction.findMany({
    where: { status: "FAILED", retryCount: { lt: MAX_RETRIES } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    include: {
      webhookEvent: { include: { repository: { include: { user: true } } } },
    },
  });

  for (const action of failedGh) {
    summary.githubRetried += 1;
    const token = safeDecrypt(
      action.webhookEvent.repository?.user.encryptedAccessToken,
    );
    const p = (action.payload ?? {}) as GhPayload;
    const started = performance.now();

    if (!token || !p.owner || !p.repo || p.issueNumber == null) {
      await prisma.gitHubAction.update({
        where: { id: action.id },
        data: {
          retryCount: { increment: 1 },
          errorMessage: "Retry skipped: missing token or action parameters",
        },
      });
      continue;
    }

    try {
      let responseUrl: string | null = null;
      if (action.actionType === "ADD_LABEL" && p.labels?.length) {
        for (const label of p.labels) {
          await github.ensureLabel(token, p.owner, p.repo, label);
        }
        await github.addLabels(token, p.owner, p.repo, p.issueNumber, p.labels);
      } else if (action.actionType === "ADD_COMMENT" && p.body) {
        responseUrl = await github.createComment(
          token,
          p.owner,
          p.repo,
          p.issueNumber,
          p.body,
        );
      }
      const latencyMs = Math.round(performance.now() - started);
      await prisma.gitHubAction.update({
        where: { id: action.id },
        data: {
          status: "SUCCESS",
          retryCount: { increment: 1 },
          latencyMs,
          responseUrl,
          errorMessage: null,
        },
      });
      await recordRetryLog(action.webhookEventId, action.actionType, "SUCCESS", latencyMs);
      summary.githubSucceeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.gitHubAction.update({
        where: { id: action.id },
        data: { retryCount: { increment: 1 }, errorMessage: message },
      });
      await recordRetryLog(action.webhookEventId, action.actionType, "FAILED", undefined, message);
    }
  }

  // --- Slack deliveries -----------------------------------------------------
  const failedSlack = await prisma.slackDelivery.findMany({
    where: { status: "FAILED", retryCount: { lt: MAX_RETRIES } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    include: {
      webhookEvent: { include: { repository: { include: { user: true } } } },
    },
  });

  for (const delivery of failedSlack) {
    summary.slackRetried += 1;
    const user = delivery.webhookEvent.repository?.user;
    const slackUrl =
      safeDecrypt(user?.encryptedSlackWebhook) || env.SLACK_WEBHOOK_URL || null;
    const started = performance.now();

    if (!slackUrl) {
      await prisma.slackDelivery.update({
        where: { id: delivery.id },
        data: {
          retryCount: { increment: 1 },
          errorMessage: "Retry skipped: Slack not configured",
        },
      });
      continue;
    }

    const body = delivery.payload ?? { text: delivery.messageText };
    try {
      const res = await postSlackPayload(slackUrl, body);
      const latencyMs = Math.round(performance.now() - started);
      if (res.ok) {
        await prisma.slackDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SUCCESS",
            statusCode: res.status,
            retryCount: { increment: 1 },
            latencyMs,
            errorMessage: null,
          },
        });
        summary.slackSucceeded += 1;
      } else {
        await prisma.slackDelivery.update({
          where: { id: delivery.id },
          data: {
            statusCode: res.status,
            retryCount: { increment: 1 },
            latencyMs,
            errorMessage: `Slack responded ${res.status}`,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.slackDelivery.update({
        where: { id: delivery.id },
        data: { retryCount: { increment: 1 }, errorMessage: message },
      });
    }
  }

  log.info("Retry sweep complete", { ...summary });
  return summary;
}

async function recordRetryLog(
  webhookEventId: string,
  actionType: string,
  status: "SUCCESS" | "FAILED",
  latencyMs?: number,
  errorMessage?: string,
): Promise<void> {
  await prisma.actionLog.create({
    data: {
      webhookEventId,
      step: `RETRY_${actionType}`,
      status,
      message:
        status === "SUCCESS"
          ? `Retry succeeded for ${actionType}`
          : `Retry failed for ${actionType}`,
      latencyMs,
      errorMessage,
    },
  });
}
