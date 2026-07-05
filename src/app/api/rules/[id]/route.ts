import { prisma } from "@/lib/prisma";
import { json, apiError, requireUserId } from "@/lib/http";
import { ruleUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function ownedRule(userId: string, id: string) {
  const rule = await prisma.rule.findUnique({ where: { id } });
  return rule && rule.userId === userId ? rule : null;
}

/** Update a rule (partial). */
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;
  if (!(await ownedRule(userId, id))) return apiError("Rule not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = ruleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 422, {
      issues: parsed.error.flatten(),
    });
  }

  const rule = await prisma.rule.update({
    where: { id },
    data: parsed.data,
    include: { repository: { select: { fullName: true } } },
  });

  return json({ rule });
}

/** Delete a rule. */
export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;
  if (!(await ownedRule(userId, id))) return apiError("Rule not found", 404);

  await prisma.rule.delete({ where: { id } });
  return json({ success: true });
}
