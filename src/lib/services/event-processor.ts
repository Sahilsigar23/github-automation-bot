import { EventType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { extractEventContext } from "@/lib/webhook";
import {
  matchesRule,
  buildTemplateVars,
  renderTemplate,
} from "@/lib/rule-engine";
import { isActionableEvent } from "@/lib/constants";
import { isAiConfigured, env } from "@/lib/env";
import { safeDecrypt } from "@/lib/crypto";
import { analyzeEvent } from "@/lib/gemini";
import * as github from "@/lib/github";
import {
  buildSlackPayload,
  postSlackPayload,
  type SlackNotification,
} from "@/lib/slack";
import type { AIResult, EventContext } from "@/types";

const log = createLogger("processor");

type UserWithSecrets = {
  id: string;
  encryptedAccessToken: string | null;
  encryptedSlackWebhook: string | null;
  aiEnabled: boolean;
  slackEnabled: boolean;
};

/** Resolve the effective Slack webhook: personal override, else global env. */
function resolveSlackUrl(user: UserWithSecrets): string | null {
  if (!user.slackEnabled) return null;
  const personal = safeDecrypt(user.encryptedSlackWebhook);
  return personal || env.SLACK_WEBHOOK_URL || null;
}

/**
 * Process a stored webhook event: run AI enrichment, evaluate rules, perform
 * GitHub write-backs, send Slack, and record every step with latency/status.
 *
 * Designed to never throw to the caller — the webhook endpoint has already
 * ACKed GitHub. All failures are persisted (status FAILED + retryCount) so the
 * retry cron can pick them up. Nothing is silently lost.
 */
export async function processWebhookEvent(webhookEventId: string): Promise<void> {
  const start = performance.now();

  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    include: { repository: { include: { user: true } } },
  });
  if (!event) {
    log.warn("Event not found for processing", { webhookEventId });
    return;
  }

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSING" },
  });

  const ctx = extractEventContext(event.eventType, event.payload);
  const actionsPerformed: string[] = [];
  let anyFailure = false;

  try {
    const repo = event.repository;
    if (!repo) {
      await finalize(event.id, "SKIPPED", start, "Repository not connected");
      return;
    }

    const user = repo.user as UserWithSecrets;
    const token = safeDecrypt(user.encryptedAccessToken);
    const actionable = isActionableEvent(event.eventType, ctx.action);

    // --- 1. AI enrichment (best-effort, cached per event) ------------------
    let ai: AIResult | null = null;
    const aiEligible =
      actionable &&
      (event.eventType === "issues" || event.eventType === "pull_request");
    if (aiEligible && user.aiEnabled && isAiConfigured()) {
      ai = await runAiAnalysis(event.id, ctx);
    }

    // --- 2. Rule evaluation + write-backs ----------------------------------
    let slackWanted = false;
    if (actionable) {
      const rules = await prisma.rule.findMany({
        where: {
          repositoryId: repo.id,
          eventType: event.eventType as EventType,
          enabled: true,
        },
      });

      for (const rule of rules) {
        const match = matchesRule(rule, ctx);
        if (!match.matched) continue;

        await logStep(event.id, rule.id, "MATCH", "SUCCESS", match.reason);
        if (rule.slackEnabled) slackWanted = true;

        const owner = repo.owner;
        const repoName = repo.name;

        if (rule.action === "ADD_LABEL" && rule.actionValue) {
          if (!token) {
            await logStep(
              event.id,
              rule.id,
              "ADD_LABEL",
              "SKIPPED",
              "No GitHub token available for this user",
            );
          } else if (ctx.number == null) {
            await logStep(
              event.id,
              rule.id,
              "ADD_LABEL",
              "SKIPPED",
              "Event has no issue/PR number to label",
            );
          } else {
            const ok = await performAddLabel(
              event.id,
              rule.id,
              token,
              owner,
              repoName,
              ctx.number,
              rule.actionValue,
              ctx.htmlUrl,
            );
            if (ok) actionsPerformed.push(`Added label "${rule.actionValue}"`);
            else anyFailure = true;
          }
        } else if (rule.action === "ADD_COMMENT" && rule.actionValue) {
          if (!token) {
            await logStep(
              event.id,
              rule.id,
              "ADD_COMMENT",
              "SKIPPED",
              "No GitHub token available for this user",
            );
          } else if (ctx.number == null) {
            await logStep(
              event.id,
              rule.id,
              "ADD_COMMENT",
              "SKIPPED",
              "Event has no issue/PR number to comment on",
            );
          } else {
            const body = renderTemplate(
              rule.actionValue,
              buildTemplateVars(ctx),
            );
            const ok = await performComment(
              event.id,
              rule.id,
              token,
              owner,
              repoName,
              ctx.number,
              body,
            );
            if (ok) actionsPerformed.push("Posted a comment");
            else anyFailure = true;
          }
        } else if (rule.action === "NONE") {
          await logStep(
            event.id,
            rule.id,
            "SKIP",
            "SUCCESS",
            "Notify-only rule (no write-back)",
          );
        }
      }
    } else {
      await logStep(
        event.id,
        null,
        "SKIP",
        "SKIPPED",
        `Event action "${ctx.action ?? "n/a"}" is not actionable`,
      );
    }

    // --- 3. Slack notification (one per event, if any rule requested it) ----
    if (slackWanted) {
      const slackUrl = resolveSlackUrl(user);
      if (!slackUrl) {
        await logStep(
          event.id,
          null,
          "SLACK",
          "SKIPPED",
          "Slack is not configured",
        );
      } else {
        const ok = await performSlack(event.id, slackUrl, ctx, ai, actionsPerformed);
        if (!ok) anyFailure = true;
      }
    }

    await finalize(
      event.id,
      anyFailure ? "FAILED" : "PROCESSED",
      start,
      anyFailure ? "One or more actions failed — see logs" : null,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Unhandled processing error", { webhookEventId: event.id, message });
    await finalize(event.id, "FAILED", start, message);
  }
}

// --------------------------------------------------------------------------
// Step helpers — each persists a row and returns success where relevant.
// --------------------------------------------------------------------------

async function runAiAnalysis(
  eventId: string,
  ctx: EventContext,
): Promise<AIResult | null> {
  // Return cached analysis if we already have it.
  const cached = await prisma.aIAnalysis.findUnique({
    where: { webhookEventId: eventId },
  });
  if (cached) {
    return {
      summary: cached.summary,
      priority: cached.priority,
      suggestedLabel: cached.suggestedLabel,
      model: cached.model,
      raw: cached.raw,
    };
  }

  const started = performance.now();
  try {
    const result = await analyzeEvent({
      eventType: ctx.eventType,
      title: ctx.title ?? "",
      body: ctx.body,
    });
    const latencyMs = Math.round(performance.now() - started);
    await prisma.aIAnalysis.create({
      data: {
        webhookEventId: eventId,
        summary: result.summary,
        priority: result.priority,
        suggestedLabel: result.suggestedLabel,
        model: result.model,
        raw: (result.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        latencyMs,
        cached: true,
      },
    });
    await logStep(
      eventId,
      null,
      "AI",
      "SUCCESS",
      `AI: ${result.priority} priority`,
      latencyMs,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logStep(eventId, null, "AI", "FAILED", message, undefined, message);
    return null;
  }
}

async function performAddLabel(
  eventId: string,
  ruleId: string,
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string,
  htmlUrl: string | null,
): Promise<boolean> {
  const started = performance.now();
  const action = await prisma.gitHubAction.create({
    data: {
      webhookEventId: eventId,
      actionType: "ADD_LABEL",
      target: `issue #${issueNumber} → ${label}`,
      status: "PENDING",
      payload: { owner, repo, issueNumber, labels: [label] },
    },
  });
  try {
    const { created } = await github.ensureLabel(token, owner, repo, label);
    if (created) {
      await logStep(
        eventId,
        ruleId,
        "CREATE_LABEL",
        "SUCCESS",
        `Created missing label "${label}"`,
      );
    }
    await github.addLabels(token, owner, repo, issueNumber, [label]);
    const latencyMs = Math.round(performance.now() - started);
    await prisma.gitHubAction.update({
      where: { id: action.id },
      data: { status: "SUCCESS", latencyMs, responseUrl: htmlUrl },
    });
    await logStep(
      eventId,
      ruleId,
      "ADD_LABEL",
      "SUCCESS",
      `Applied label "${label}" to #${issueNumber}`,
      latencyMs,
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Math.round(performance.now() - started);
    await prisma.gitHubAction.update({
      where: { id: action.id },
      data: { status: "FAILED", latencyMs, errorMessage: message },
    });
    await logStep(
      eventId,
      ruleId,
      "ADD_LABEL",
      "FAILED",
      `Failed to apply label "${label}"`,
      latencyMs,
      message,
    );
    return false;
  }
}

async function performComment(
  eventId: string,
  ruleId: string,
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<boolean> {
  const started = performance.now();
  const action = await prisma.gitHubAction.create({
    data: {
      webhookEventId: eventId,
      actionType: "ADD_COMMENT",
      target: `issue #${issueNumber}`,
      status: "PENDING",
      payload: { owner, repo, issueNumber, body },
    },
  });
  try {
    const url = await github.createComment(token, owner, repo, issueNumber, body);
    const latencyMs = Math.round(performance.now() - started);
    await prisma.gitHubAction.update({
      where: { id: action.id },
      data: { status: "SUCCESS", latencyMs, responseUrl: url },
    });
    await logStep(
      eventId,
      ruleId,
      "ADD_COMMENT",
      "SUCCESS",
      `Commented on #${issueNumber}`,
      latencyMs,
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Math.round(performance.now() - started);
    await prisma.gitHubAction.update({
      where: { id: action.id },
      data: { status: "FAILED", latencyMs, errorMessage: message },
    });
    await logStep(
      eventId,
      ruleId,
      "ADD_COMMENT",
      "FAILED",
      `Failed to comment on #${issueNumber}`,
      latencyMs,
      message,
    );
    return false;
  }
}

async function performSlack(
  eventId: string,
  slackUrl: string,
  ctx: EventContext,
  ai: AIResult | null,
  actionsPerformed: string[],
): Promise<boolean> {
  const notification: SlackNotification = {
    repoFullName: ctx.repoFullName,
    eventType: ctx.eventType,
    action: ctx.action,
    title: ctx.title ?? "(no title)",
    author: ctx.senderLogin ?? "unknown",
    url: ctx.htmlUrl,
    actionsPerformed,
    ai: ai
      ? {
          summary: ai.summary,
          priority: ai.priority,
          suggestedLabel: ai.suggestedLabel,
        }
      : null,
    timestamp: new Date(),
  };
  const payload = buildSlackPayload(notification);
  const started = performance.now();

  const delivery = await prisma.slackDelivery.create({
    data: {
      webhookEventId: eventId,
      messageText: payload.text,
      status: "PENDING",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    const res = await postSlackPayload(slackUrl, payload);
    const latencyMs = Math.round(performance.now() - started);
    if (res.ok) {
      await prisma.slackDelivery.update({
        where: { id: delivery.id },
        data: { status: "SUCCESS", statusCode: res.status, latencyMs },
      });
      await logStep(eventId, null, "SLACK", "SUCCESS", "Slack delivered", latencyMs);
      return true;
    }
    await prisma.slackDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        statusCode: res.status,
        latencyMs,
        errorMessage: `Slack responded ${res.status}: ${res.text}`.slice(0, 500),
      },
    });
    await logStep(
      eventId,
      null,
      "SLACK",
      "FAILED",
      `Slack responded ${res.status}`,
      latencyMs,
      res.text.slice(0, 500),
    );
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Math.round(performance.now() - started);
    await prisma.slackDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", latencyMs, errorMessage: message },
    });
    await logStep(eventId, null, "SLACK", "FAILED", message, latencyMs, message);
    return false;
  }
}

async function logStep(
  webhookEventId: string,
  ruleId: string | null,
  step: string,
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "PENDING",
  message: string,
  latencyMs?: number,
  errorMessage?: string,
): Promise<void> {
  await prisma.actionLog.create({
    data: {
      webhookEventId,
      ruleId: ruleId ?? undefined,
      step,
      status,
      message,
      latencyMs,
      errorMessage,
    },
  });
}

async function finalize(
  webhookEventId: string,
  status: "PROCESSED" | "FAILED" | "SKIPPED",
  start: number,
  error: string | null,
): Promise<void> {
  const processingMs = Math.round(performance.now() - start);
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      status,
      processingMs,
      processedAt: new Date(),
      error: error ?? undefined,
    },
  });
  log.info("Event processed", { webhookEventId, status, processingMs });
}
