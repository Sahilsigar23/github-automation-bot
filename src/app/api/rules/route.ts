import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";
import { ruleInputSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/** List the user's rules, optionally filtered by repository. */
export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const repositoryId =
    new URL(req.url).searchParams.get("repositoryId") ?? undefined;

  const rules = await prisma.rule.findMany({
    where: { userId, repositoryId },
    orderBy: { createdAt: "desc" },
    include: { repository: { select: { fullName: true } } },
  });

  return json({ rules });
}

/** Create a rule. */
export async function POST(req: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = ruleInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 422, {
      issues: parsed.error.flatten(),
    });
  }
  const data = parsed.data;

  // Ownership check: the repository must belong to this user.
  const repo = await prisma.repository.findUnique({
    where: { id: data.repositoryId },
    select: { userId: true },
  });
  if (!repo || repo.userId !== userId) {
    return apiError("Repository not found", 404);
  }

  const rule = await prisma.rule.create({
    data: {
      userId,
      repositoryId: data.repositoryId,
      name: data.name,
      eventType: data.eventType,
      keyword: data.keyword || null,
      matchField: data.matchField,
      action: data.action,
      actionValue: data.actionValue || null,
      slackEnabled: data.slackEnabled,
      enabled: data.enabled,
    },
    include: { repository: { select: { fullName: true } } },
  });

  return json({ rule }, 201);
}
