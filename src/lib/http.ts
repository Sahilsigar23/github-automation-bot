import { ZodError } from "zod";
import { auth } from "@/lib/auth";

/** JSON.stringify replacer so Prisma BigInt fields (repo ids) serialise. */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/** BigInt-safe JSON response helper. */
export function json(data: unknown, init?: number | ResponseInit): Response {
  const responseInit: ResponseInit =
    typeof init === "number" ? { status: init } : (init ?? {});
  return new Response(JSON.stringify(data, bigintReplacer), {
    ...responseInit,
    headers: {
      "content-type": "application/json",
      ...(responseInit.headers ?? {}),
    },
  });
}

export function apiError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return json({ error: message, ...extra }, status);
}

export function zodErrorResponse(err: ZodError): Response {
  return apiError("Validation failed", 422, { issues: err.flatten() });
}

/** Return the authenticated user id, or null. */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
