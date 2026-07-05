import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";
import { settingsSchema } from "@/lib/validations";
import { encrypt } from "@/lib/crypto";
import { env, isAiConfigured, webhookUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Return non-secret settings + environment capability flags. */
export async function GET(): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      aiEnabled: true,
      slackEnabled: true,
      githubLogin: true,
      encryptedSlackWebhook: true,
    },
  });
  if (!user) return apiError("User not found", 404);

  return json({
    settings: {
      aiEnabled: user.aiEnabled,
      slackEnabled: user.slackEnabled,
      githubLogin: user.githubLogin,
      // Only booleans — never the secret values themselves.
      personalSlackConfigured: Boolean(user.encryptedSlackWebhook),
      globalSlackConfigured: Boolean(env.SLACK_WEBHOOK_URL),
      aiConfigured: isAiConfigured(),
      webhookSecretConfigured: Boolean(env.GITHUB_WEBHOOK_SECRET),
      webhookUrl: webhookUrl(),
    },
  });
}

/** Update settings. Slack webhook is encrypted at rest; "" clears it. */
export async function PATCH(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 422, {
      issues: parsed.error.flatten(),
    });
  }
  const { slackWebhookUrl, aiEnabled, slackEnabled } = parsed.data;

  const data: {
    aiEnabled?: boolean;
    slackEnabled?: boolean;
    encryptedSlackWebhook?: string | null;
  } = {};
  if (typeof aiEnabled === "boolean") data.aiEnabled = aiEnabled;
  if (typeof slackEnabled === "boolean") data.slackEnabled = slackEnabled;
  if (slackWebhookUrl !== undefined) {
    data.encryptedSlackWebhook = slackWebhookUrl
      ? encrypt(slackWebhookUrl)
      : null;
  }

  await prisma.user.update({ where: { id: userId }, data });
  return json({ success: true });
}
