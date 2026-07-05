import { describe, it, expect } from "vitest";
import {
  matchesRule,
  renderTemplate,
  buildTemplateVars,
  type EvaluableRule,
} from "@/lib/rule-engine";
import type { EventContext } from "@/types";

const baseCtx: EventContext = {
  eventType: "issues",
  action: "opened",
  repoFullName: "octo/repo",
  senderLogin: "alice",
  title: "Login button has a BUG on Safari",
  body: "Detailed reproduction steps here",
  number: 42,
  htmlUrl: "https://gh/issues/42",
};

function rule(overrides: Partial<EvaluableRule>): EvaluableRule {
  return {
    id: "r1",
    enabled: true,
    eventType: "issues",
    keyword: "bug",
    matchField: "title",
    ...overrides,
  };
}

describe("matchesRule", () => {
  it("matches a keyword in the title (case-insensitive)", () => {
    expect(matchesRule(rule({}), baseCtx).matched).toBe(true);
  });

  it("does not match a disabled rule", () => {
    expect(matchesRule(rule({ enabled: false }), baseCtx).matched).toBe(false);
  });

  it("does not match a different event type", () => {
    expect(matchesRule(rule({ eventType: "push" }), baseCtx).matched).toBe(
      false,
    );
  });

  it("matches all events when keyword is empty", () => {
    expect(matchesRule(rule({ keyword: "" }), baseCtx).matched).toBe(true);
    expect(matchesRule(rule({ keyword: null }), baseCtx).matched).toBe(true);
  });

  it("respects the body match field", () => {
    expect(
      matchesRule(rule({ keyword: "reproduction", matchField: "body" }), baseCtx)
        .matched,
    ).toBe(true);
    expect(
      matchesRule(rule({ keyword: "reproduction", matchField: "title" }), baseCtx)
        .matched,
    ).toBe(false);
  });

  it("matches either field when matchField is 'any'", () => {
    expect(
      matchesRule(rule({ keyword: "safari", matchField: "any" }), baseCtx)
        .matched,
    ).toBe(true);
  });

  it("returns not-matched with a reason when keyword absent", () => {
    const result = matchesRule(rule({ keyword: "nonexistent" }), baseCtx);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("not found");
  });
});

describe("buildTemplateVars + renderTemplate", () => {
  it("renders all supported variables", () => {
    const vars = buildTemplateVars(baseCtx);
    const out = renderTemplate(
      "Hi @{{author}} — {{title}} in {{repo}} (#{{number}}) {{url}}",
      vars,
    );
    expect(out).toBe(
      "Hi @alice — Login button has a BUG on Safari in octo/repo (#42) https://gh/issues/42",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    const out = renderTemplate("Hello {{unknown}}", buildTemplateVars(baseCtx));
    expect(out).toBe("Hello {{unknown}}");
  });

  it("defaults author to 'there' when sender is missing", () => {
    const vars = buildTemplateVars({ ...baseCtx, senderLogin: null });
    expect(renderTemplate("@{{author}}", vars)).toBe("@there");
  });
});
