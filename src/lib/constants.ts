/**
 * Shared, non-secret constants and option lists used by the rule engine,
 * validation schemas and the rule-builder UI. Keeping these in one place means
 * the DB enums, Zod schemas and dropdowns never drift apart.
 */

export const EVENT_TYPES = [
  { value: "issues", label: "Issues" },
  { value: "pull_request", label: "Pull Requests" },
  { value: "push", label: "Push" },
] as const;

export const MATCH_FIELDS = [
  { value: "title", label: "Title" },
  { value: "body", label: "Body / description" },
  { value: "any", label: "Title or body" },
] as const;

export const RULE_ACTIONS = [
  { value: "ADD_LABEL", label: "Add label" },
  { value: "ADD_COMMENT", label: "Post comment" },
  { value: "NONE", label: "Notify only (no write-back)" },
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** GitHub webhook events we subscribe to when auto-registering a hook. */
export const SUBSCRIBED_EVENTS = ["issues", "pull_request", "push"];

/**
 * Which `action` values are worth running the rule engine for. Editing an
 * issue title should re-evaluate; a bot closing it should not spam actions.
 */
export const ACTIONABLE_ACTIONS: Record<string, string[]> = {
  issues: ["opened", "edited", "reopened"],
  pull_request: ["opened", "edited", "reopened", "ready_for_review"],
};

/** `push` has no `action` field — always actionable. */
export function isActionableEvent(
  eventType: string,
  action: string | null | undefined,
): boolean {
  if (eventType === "push") return true;
  const allowed = ACTIONABLE_ACTIONS[eventType];
  if (!allowed) return false;
  return action ? allowed.includes(action) : false;
}

export const DEFAULT_LABEL_COLOR = "d73a4a"; // GitHub's canonical "bug" red
export const MAX_RETRIES = 3;

/** Dashboard live-refresh cadence (ms). */
export const LIVE_REFRESH_MS = 5000;
