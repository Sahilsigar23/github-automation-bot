/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * NOTE ON SERVERLESS: state lives in a single process. On Vercel each function
 * instance keeps its own window, so this is a best-effort guard against bursts
 * / accidental loops rather than a globally-consistent limit. For strict global
 * limits, back this with Upstash Redis (see README "Known limitations"). It is
 * still valuable: a single hot instance handling a flood will shed load.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, limit, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    limit,
    resetAt: existing.resetAt,
  };
}

/** Opportunistic cleanup so the map doesn't grow unbounded. */
export function sweepExpired(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
