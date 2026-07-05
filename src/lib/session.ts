import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeDecrypt } from "@/lib/crypto";

/** The session user (id + basic profile) or null. Never contains secrets. */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Full DB user record for the current session, or null. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/**
 * Decrypt and return the current (or given) user's GitHub access token.
 * Returns null if absent/undecryptable. Server-only — never expose to client.
 */
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptedAccessToken: true },
  });
  return safeDecrypt(user?.encryptedAccessToken);
}
