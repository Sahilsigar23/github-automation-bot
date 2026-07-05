/**
 * Minimal structured (JSON-line) logger. Every entry is a single JSON object
 * with a timestamp, level, scope and message — friendly to log drains like
 * Vercel, Datadog or Better Stack. Also exposes a latency helper.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: Level =
  process.env.LOG_LEVEL === "debug"
    ? "debug"
    : process.env.NODE_ENV === "production"
      ? "info"
      : "debug";

function write(level: Level, scope: string, message: string, meta?: unknown) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
  };
  if (meta && typeof meta === "object") Object.assign(entry, meta);
  else if (meta !== undefined) entry.meta = meta;

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, meta) => write("debug", scope, m, meta),
    info: (m, meta) => write("info", scope, m, meta),
    warn: (m, meta) => write("warn", scope, m, meta),
    error: (m, meta) => write("error", scope, m, meta),
  };
}

export const logger = createLogger("app");

/**
 * Run an async function and measure wall-clock latency in milliseconds.
 * Always returns the elapsed time, even when the function throws.
 */
export async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - start) };
}

export function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}
