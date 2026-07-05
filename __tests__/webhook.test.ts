import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySignature, extractEventContext } from "@/lib/webhook";

const SECRET = "test-webhook-secret";

function sign(body: string, secret = SECRET): string {
  return (
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")
  );
}

describe("verifySignature", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepts a valid signature", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = sign(body);
    expect(verifySignature(body + "x", signature, SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifySignature(body, sign(body, "other"), SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, undefined, SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(verifySignature(body, sign(body), "")).toBe(false);
  });

  it("rejects a malformed signature of the wrong length", () => {
    expect(verifySignature(body, "sha256=deadbeef", SECRET)).toBe(false);
  });
});

describe("extractEventContext", () => {
  it("extracts issue fields", () => {
    const ctx = extractEventContext("issues", {
      action: "opened",
      repository: { full_name: "octo/repo" },
      sender: { login: "alice" },
      issue: {
        title: "A bug appears",
        body: "steps",
        number: 7,
        html_url: "https://gh/issues/7",
      },
    });
    expect(ctx).toMatchObject({
      eventType: "issues",
      action: "opened",
      repoFullName: "octo/repo",
      senderLogin: "alice",
      title: "A bug appears",
      body: "steps",
      number: 7,
      htmlUrl: "https://gh/issues/7",
    });
  });

  it("extracts pull_request fields", () => {
    const ctx = extractEventContext("pull_request", {
      action: "opened",
      repository: { full_name: "octo/repo" },
      sender: { login: "bob" },
      pull_request: {
        title: "Add feature",
        body: null,
        number: 12,
        html_url: "https://gh/pull/12",
      },
    });
    expect(ctx.number).toBe(12);
    expect(ctx.title).toBe("Add feature");
    expect(ctx.body).toBeNull();
  });

  it("summarises push events", () => {
    const ctx = extractEventContext("push", {
      repository: { full_name: "octo/repo" },
      pusher: { name: "carol" },
      ref: "refs/heads/main",
      commits: [{}, {}],
      head_commit: { message: "fix: thing" },
      compare: "https://gh/compare/abc",
    });
    expect(ctx.eventType).toBe("push");
    expect(ctx.senderLogin).toBe("carol");
    expect(ctx.title).toBe("fix: thing");
    expect(ctx.htmlUrl).toBe("https://gh/compare/abc");
  });

  it("falls back gracefully on unknown payloads", () => {
    const ctx = extractEventContext("issues", {});
    expect(ctx.repoFullName).toBe("unknown/unknown");
    expect(ctx.title).toBeNull();
  });
});
