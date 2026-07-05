/**
 * Centralised environment access.
 *
 * We intentionally do NOT throw at import time (that would break `next build`
 * on machines without a full `.env`). Required values are validated lazily,
 * at the point of use, via `requireEnv`.
 */

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  DIRECT_URL: process.env.DIRECT_URL ?? "",

  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET ?? "",

  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "",

  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL ?? "",

  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.0-flash",

  CRON_SECRET: process.env.CRON_SECRET ?? "",

  NODE_ENV: process.env.NODE_ENV ?? "development",
} as const;

type EnvKey = keyof typeof env;

/** Throw a clear error if a required variable is missing. */
export function requireEnv(key: EnvKey): string {
  const value = env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. See .env.example.`,
    );
  }
  return value;
}

export const isSlackConfigured = (): boolean => Boolean(env.SLACK_WEBHOOK_URL);
export const isAiConfigured = (): boolean => Boolean(env.GEMINI_API_KEY);
export const isProduction = (): boolean => env.NODE_ENV === "production";

/** The public webhook URL GitHub should POST to. */
export function webhookUrl(): string {
  return `${env.NEXTAUTH_URL.replace(/\/$/, "")}/api/webhooks/github`;
}
