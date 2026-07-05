import { describe, it, expect } from "vitest";
import { isActionableEvent } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { formatMs, eventTypeLabel } from "@/lib/format";

describe("isActionableEvent", () => {
  it("treats opened/edited/reopened issues as actionable", () => {
    expect(isActionableEvent("issues", "opened")).toBe(true);
    expect(isActionableEvent("issues", "edited")).toBe(true);
    expect(isActionableEvent("issues", "reopened")).toBe(true);
  });

  it("ignores non-actionable issue actions", () => {
    expect(isActionableEvent("issues", "closed")).toBe(false);
    expect(isActionableEvent("issues", "labeled")).toBe(false);
  });

  it("treats push as always actionable", () => {
    expect(isActionableEvent("push", null)).toBe(true);
  });

  it("returns false for unknown event types", () => {
    expect(isActionableEvent("release", "published")).toBe(false);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test-${Math.random()}`;
    const limit = 3;
    const results = Array.from({ length: 4 }, () =>
      rateLimit(key, limit, 60_000),
    );
    expect(results[0]?.allowed).toBe(true);
    expect(results[1]?.allowed).toBe(true);
    expect(results[2]?.allowed).toBe(true);
    expect(results[3]?.allowed).toBe(false);
    expect(results[3]?.remaining).toBe(0);
  });

  it("tracks separate keys independently", () => {
    const a = rateLimit(`a-${Math.random()}`, 1, 60_000);
    const b = rateLimit(`b-${Math.random()}`, 1, 60_000);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});

describe("formatMs", () => {
  it("formats sub-second values in ms", () => {
    expect(formatMs(812)).toBe("812 ms");
  });
  it("formats second-scale values", () => {
    expect(formatMs(1500)).toBe("1.50 s");
  });
  it("handles null", () => {
    expect(formatMs(null)).toBe("—");
  });
});

describe("eventTypeLabel", () => {
  it("maps known event types", () => {
    expect(eventTypeLabel("pull_request")).toBe("Pull request");
    expect(eventTypeLabel("issues")).toBe("Issue");
  });
  it("passes through unknown types", () => {
    expect(eventTypeLabel("custom")).toBe("custom");
  });
});
