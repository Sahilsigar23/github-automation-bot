/** Shared application types (non-Prisma). */

/** Normalised view of a GitHub webhook payload the engine cares about. */
export interface EventContext {
  eventType: string; // issues | pull_request | push
  action: string | null; // opened, edited, closed, ...
  repoFullName: string;
  senderLogin: string | null;
  title: string | null;
  body: string | null;
  number: number | null;
  htmlUrl: string | null;
}

/** Result of matching a single rule against an event. */
export interface RuleMatch {
  ruleId: string;
  matched: boolean;
  reason: string;
}

/** Variables available to comment templates. */
export interface TemplateVars {
  author: string;
  title: string;
  repo: string;
  number: string;
  url: string;
}

/** AI enrichment result. */
export interface AIResult {
  summary: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  suggestedLabel: string | null;
  model: string;
  raw: unknown;
}

/** Repository shape returned to the client (never includes tokens). */
export interface RepoSummary {
  githubId: string;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  alreadyConnected: boolean;
}
