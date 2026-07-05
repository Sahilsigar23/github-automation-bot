import type { EventContext, TemplateVars } from "@/types";

/** Minimal rule shape the engine needs — a subset of the Prisma Rule model. */
export interface EvaluableRule {
  id: string;
  enabled: boolean;
  eventType: string; // "issues" | "pull_request" | "push"
  keyword: string | null;
  matchField: string; // "title" | "body" | "any"
}

export interface MatchResult {
  matched: boolean;
  reason: string;
}

/**
 * Decide whether a rule fires for a given event. Pure and side-effect free.
 *
 * Matching semantics:
 *  - Rule must be enabled and its eventType must equal the event's type.
 *  - An empty/blank keyword matches every event of that type.
 *  - Otherwise the keyword is a case-insensitive substring search over the
 *    configured field(s): title, body, or either.
 */
export function matchesRule(
  rule: EvaluableRule,
  ctx: EventContext,
): MatchResult {
  if (!rule.enabled) {
    return { matched: false, reason: "rule is disabled" };
  }
  if (rule.eventType !== ctx.eventType) {
    return {
      matched: false,
      reason: `event "${ctx.eventType}" does not match rule event "${rule.eventType}"`,
    };
  }

  const keyword = (rule.keyword ?? "").trim().toLowerCase();
  if (!keyword) {
    return { matched: true, reason: "no keyword configured — matches all" };
  }

  const haystacks: string[] = [];
  if (rule.matchField === "title" || rule.matchField === "any") {
    haystacks.push(ctx.title ?? "");
  }
  if (rule.matchField === "body" || rule.matchField === "any") {
    haystacks.push(ctx.body ?? "");
  }

  const found = haystacks.some((h) => h.toLowerCase().includes(keyword));
  return found
    ? { matched: true, reason: `keyword "${keyword}" found in ${rule.matchField}` }
    : { matched: false, reason: `keyword "${keyword}" not found` };
}

/** Build the variables available to a comment template. */
export function buildTemplateVars(ctx: EventContext): TemplateVars {
  return {
    author: ctx.senderLogin ?? "there",
    title: ctx.title ?? "",
    repo: ctx.repoFullName,
    number: ctx.number != null ? String(ctx.number) : "",
    url: ctx.htmlUrl ?? "",
  };
}

/**
 * Render a comment template, substituting `{{var}}` placeholders.
 * Unknown placeholders are left untouched so mistakes are visible.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  const dict: Record<string, string> = { ...vars };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => {
    const value = dict[key];
    return value !== undefined ? value : whole;
  });
}
