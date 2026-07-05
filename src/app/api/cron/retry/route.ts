import { env } from "@/lib/env";
import { retryFailedActions } from "@/lib/services/retry";
import { json, apiError } from "@/lib/http";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("cron.retry");

/**
 * Re-attempt failed GitHub actions and Slack deliveries.
 *
 * Auth: when CRON_SECRET is set, callers must send
 *   Authorization: Bearer <CRON_SECRET>
 * Vercel Cron sends this header automatically. Without a configured secret the
 * endpoint runs (dev convenience) but logs a warning.
 */
async function handle(req: Request): Promise<Response> {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return apiError("Unauthorized", 401);
    }
  } else {
    log.warn("CRON_SECRET is not set — retry endpoint is unauthenticated");
  }

  const summary = await retryFailedActions();
  return json({ ok: true, ...summary });
}

// Vercel Cron triggers GET; POST is supported for manual invocation.
export const GET = handle;
export const POST = handle;
