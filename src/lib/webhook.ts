import crypto from "node:crypto";
import type { EventContext } from "@/types";

/**
 * Verify a GitHub webhook signature (X-Hub-Signature-256).
 *
 * GitHub signs the raw request body with HMAC-SHA256 using the shared secret
 * and sends it as `sha256=<hex>`. We recompute and compare in constant time.
 *
 * Pure + dependency-free so it is trivially unit-testable.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);

  // timingSafeEqual throws if lengths differ — guard first.
  if (received.length !== computed.length) return false;
  return crypto.timingSafeEqual(received, computed);
}

interface WebhookPayload {
  action?: string;
  repository?: { full_name?: string };
  sender?: { login?: string };
  issue?: {
    title?: string;
    body?: string | null;
    number?: number;
    html_url?: string;
  };
  pull_request?: {
    title?: string;
    body?: string | null;
    number?: number;
    html_url?: string;
  };
  head_commit?: { message?: string; url?: string } | null;
  commits?: unknown[];
  ref?: string;
  compare?: string;
  pusher?: { name?: string };
}

/** Normalise a raw webhook payload into the shape the rule engine consumes. */
export function extractEventContext(
  eventType: string,
  payload: unknown,
): EventContext {
  const p = (payload ?? {}) as WebhookPayload;
  const repoFullName = p.repository?.full_name ?? "unknown/unknown";
  const senderLogin = p.sender?.login ?? p.pusher?.name ?? null;

  if (eventType === "issues" && p.issue) {
    return {
      eventType,
      action: p.action ?? null,
      repoFullName,
      senderLogin,
      title: p.issue.title ?? null,
      body: p.issue.body ?? null,
      number: p.issue.number ?? null,
      htmlUrl: p.issue.html_url ?? null,
    };
  }

  if (eventType === "pull_request" && p.pull_request) {
    return {
      eventType,
      action: p.action ?? null,
      repoFullName,
      senderLogin,
      title: p.pull_request.title ?? null,
      body: p.pull_request.body ?? null,
      number: p.pull_request.number ?? null,
      htmlUrl: p.pull_request.html_url ?? null,
    };
  }

  if (eventType === "push") {
    const count = Array.isArray(p.commits) ? p.commits.length : 0;
    const branch = (p.ref ?? "").replace("refs/heads/", "");
    return {
      eventType,
      action: null,
      repoFullName,
      senderLogin,
      title:
        p.head_commit?.message ??
        `${count} commit${count === 1 ? "" : "s"} pushed to ${branch || "a branch"}`,
      body: null,
      number: null,
      htmlUrl: p.compare ?? p.head_commit?.url ?? null,
    };
  }

  // Unknown / unsupported event — still capture what we can.
  return {
    eventType,
    action: p.action ?? null,
    repoFullName,
    senderLogin,
    title: null,
    body: null,
    number: null,
    htmlUrl: null,
  };
}
