import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { verifySignature, extractEventContext } from "@/lib/webhook";
import { rateLimit } from "@/lib/rate-limit";
import { processWebhookEvent } from "@/lib/services/event-processor";
import { createLogger } from "@/lib/logger";

// Needs Node crypto + Prisma; must not be edge or statically optimised.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("webhook");

/**
 * GitHub webhook receiver.
 *
 * Pipeline: rate-limit → verify HMAC signature → parse → dedupe by delivery id
 * → store → ACK fast (202) → process in the background via `after()`.
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const eventType = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";

  // 1. Rate limit (best-effort, per source IP).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(`webhook:${ip}`, 120, 60_000);
  if (!rl.allowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "retry-after": Math.ceil((rl.resetAt - Date.now()) / 1000).toString(),
      },
    });
  }

  // 2. Verify signature.
  if (!env.GITHUB_WEBHOOK_SECRET) {
    log.error("GITHUB_WEBHOOK_SECRET is not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }
  if (!verifySignature(raw, signature, env.GITHUB_WEBHOOK_SECRET)) {
    log.warn("Rejected webhook with invalid signature", { deliveryId, ip });
    return new Response("Invalid signature", { status: 401 });
  }

  // 3. GitHub's connectivity test.
  if (eventType === "ping") {
    return Response.json({ ok: true, pong: true });
  }
  if (!deliveryId) {
    return new Response("Missing X-GitHub-Delivery header", { status: 400 });
  }

  // 4. Parse payload.
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }
  const ctx = extractEventContext(eventType, payload);

  // Link to a connected repository if we track it.
  const repo = await prisma.repository.findUnique({
    where: { fullName: ctx.repoFullName },
    select: { id: true },
  });

  // 5. Store with duplicate protection (unique deliveryId).
  try {
    const event = await prisma.webhookEvent.create({
      data: {
        deliveryId,
        eventType,
        action: ctx.action,
        repositoryId: repo?.id,
        repoFullName: ctx.repoFullName,
        senderLogin: ctx.senderLogin,
        title: ctx.title,
        number: ctx.number,
        htmlUrl: ctx.htmlUrl,
        payload: payload as Prisma.InputJsonValue,
        status: "RECEIVED",
      },
      select: { id: true },
    });

    // 6. ACK immediately; process after the response is flushed.
    after(async () => {
      try {
        await processWebhookEvent(event.id);
      } catch (err) {
        log.error("Background processing threw", {
          id: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    return Response.json({ received: true, id: event.id }, { status: 202 });
  } catch (err) {
    // Duplicate delivery → idempotent success (do not reprocess).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      log.info("Ignored duplicate delivery", { deliveryId });
      return Response.json({ received: true, duplicate: true }, { status: 200 });
    }
    log.error("Failed to persist webhook event", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Failed to store event", { status: 500 });
  }
}

// Reject non-POST methods explicitly.
export function GET(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}
