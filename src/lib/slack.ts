/**
 * Slack Incoming Webhook client + Block Kit message builder.
 * No SDK required — an Incoming Webhook is a simple JSON POST.
 */

export interface SlackNotification {
  repoFullName: string;
  eventType: string;
  action: string | null;
  title: string;
  author: string;
  url: string | null;
  actionsPerformed: string[];
  ai?: {
    summary: string;
    priority: string;
    suggestedLabel: string | null;
  } | null;
  timestamp: Date;
}

const EVENT_EMOJI: Record<string, string> = {
  issues: "🐞",
  pull_request: "🔀",
  push: "📦",
};

const PRIORITY_EMOJI: Record<string, string> = {
  LOW: "🟢",
  MEDIUM: "🟡",
  HIGH: "🟠",
  CRITICAL: "🔴",
};

function eventLabel(eventType: string, action: string | null): string {
  const base =
    eventType === "pull_request"
      ? "Pull request"
      : eventType === "issues"
        ? "Issue"
        : "Push";
  return action ? `${base} ${action}` : base;
}

/** Plain-text fallback (used by notifications and screen readers). */
export function buildSlackText(n: SlackNotification): string {
  const emoji = EVENT_EMOJI[n.eventType] ?? "🔔";
  return `${emoji} ${eventLabel(n.eventType, n.action)} in ${n.repoFullName}: ${n.title}`;
}

/** Rich Block Kit payload. */
export function buildSlackBlocks(n: SlackNotification): unknown[] {
  const emoji = EVENT_EMOJI[n.eventType] ?? "🔔";
  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${eventLabel(n.eventType, n.action)}`.slice(0, 150),
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: n.url
          ? `*<${n.url}|${escapeMrkdwn(n.title)}>*`
          : `*${escapeMrkdwn(n.title)}*`,
      },
      fields: [
        { type: "mrkdwn", text: `*Repository*\n${n.repoFullName}` },
        { type: "mrkdwn", text: `*Author*\n${n.author}` },
      ],
    },
  ];

  if (n.ai) {
    const p = PRIORITY_EMOJI[n.ai.priority] ?? "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*🤖 AI summary*\n${escapeMrkdwn(n.ai.summary)}\n` +
          `*Priority:* ${p} ${n.ai.priority}` +
          (n.ai.suggestedLabel
            ? `   *Suggested label:* \`${n.ai.suggestedLabel}\``
            : ""),
      },
    });
  }

  if (n.actionsPerformed.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Actions performed*\n${n.actionsPerformed
          .map((a) => `• ${a}`)
          .join("\n")}`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `github-automation-bot • ${n.timestamp.toISOString()}`,
      },
    ],
  });

  return blocks;
}

export interface SlackResult {
  ok: boolean;
  status: number;
  text: string;
}

/** Build the exact JSON body sent to Slack (also persisted for retries). */
export function buildSlackPayload(notification: SlackNotification): {
  text: string;
  blocks: unknown[];
} {
  return {
    text: buildSlackText(notification),
    blocks: buildSlackBlocks(notification),
  };
}

/** POST a pre-built Block Kit body to a Slack Incoming Webhook URL. */
export async function postSlackPayload(
  webhookUrl: string,
  payload: unknown,
): Promise<SlackResult> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/** Build + POST a notification to a Slack Incoming Webhook URL. */
export async function sendSlack(
  webhookUrl: string,
  notification: SlackNotification,
): Promise<SlackResult> {
  return postSlackPayload(webhookUrl, buildSlackPayload(notification));
}

/** Slack mrkdwn escaping for the three reserved characters. */
function escapeMrkdwn(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
