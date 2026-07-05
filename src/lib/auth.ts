import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");

/** Raw GitHub OAuth profile fields we consume. */
interface GitHubProfile {
  id: number;
  login: string;
  avatar_url?: string;
  name?: string | null;
  email?: string | null;
}

/**
 * Scopes:
 *  - read:user, user:email  → identity + profile
 *  - repo                   → read repos + write labels/comments (public+private)
 *  - admin:repo_hook        → auto-register webhooks on connect
 */
const GITHUB_SCOPES = "read:user user:email repo admin:repo_hook";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  secret: env.NEXTAUTH_SECRET,
  // Required when the deployment host isn't auto-detected (custom domains, etc).
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GitHub({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorization: { params: { scope: GITHUB_SCOPES } },
    }),
  ],
  callbacks: {
    // Surface the DB user id + github login on the session (safe, non-secret).
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.githubLogin = user.githubLogin ?? null;
      }
      return session;
    },
  },
  events: {
    /**
     * After a successful sign-in, persist the GitHub access token ENCRYPTED
     * onto the user record and cache profile fields. The token never leaves
     * the server and is only ever decrypted when calling the GitHub API.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github" || !user.id) return;

      const data: Record<string, unknown> = {};

      if (account.access_token) {
        data.encryptedAccessToken = encrypt(account.access_token);
      }

      const gh = profile as unknown as GitHubProfile | undefined;
      if (gh) {
        if (gh.id != null) data.githubId = String(gh.id);
        if (gh.login) data.githubLogin = gh.login;
        if (!user.image && gh.avatar_url) data.image = gh.avatar_url;
      }

      if (Object.keys(data).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data });
        log.info("Stored encrypted GitHub token for user", {
          userId: user.id,
          login: gh?.login,
        });
      }
    },
  },
});
