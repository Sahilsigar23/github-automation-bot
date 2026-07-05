/** Response shapes returned by the app's own API routes (client-facing). */

export interface EventListItem {
  id: string;
  deliveryId: string;
  eventType: string;
  action: string | null;
  repoFullName: string;
  title: string | null;
  number: number | null;
  htmlUrl: string | null;
  status: string;
  processingMs: number | null;
  receivedAt: string;
  aiAnalysis: { priority: string; summary: string } | null;
  githubActions: { status: string }[];
  slackDeliveries: { status: string }[];
  _count: { actionLogs: number };
}

export interface EventsResponse {
  events: EventListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface StatsResponse {
  stats: {
    repositories: number;
    rules: number;
    events: {
      total: number;
      processed: number;
      failed: number;
      skipped: number;
      pending: number;
    };
    github: { success: number; failed: number };
    slack: { success: number; failed: number };
    ai: number;
    latency: {
      processingMs: number | null;
      githubMs: number | null;
      slackMs: number | null;
    };
  };
}

export interface RepoItem {
  id: string;
  githubId: string;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  webhookActive: boolean;
  connectedAt: string;
  _count: { rules: number; events: number };
}

export interface RepoAvailable {
  githubId: string;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  alreadyConnected: boolean;
}

export interface RuleItem {
  id: string;
  name: string;
  eventType: string;
  keyword: string | null;
  matchField: string;
  action: string;
  actionValue: string | null;
  slackEnabled: boolean;
  enabled: boolean;
  repositoryId: string;
  createdAt: string;
  repository: { fullName: string };
}

export interface LogItem {
  id: string;
  step: string;
  status: string;
  message: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  retryCount: number;
  createdAt: string;
  webhookEvent: {
    id: string;
    repoFullName: string;
    eventType: string;
    title: string | null;
    number: number | null;
  };
}
