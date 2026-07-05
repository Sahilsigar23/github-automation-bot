import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth gate (Auth.js v5 recommended pattern for the Prisma adapter).
 *
 * Middleware runs on the Edge runtime where Prisma can't, so we only check for
 * the presence of a session cookie here for a fast, hard redirect. The
 * authoritative check — validating the session against the database — still
 * happens in the (dashboard) layout via `auth()`. Defense in depth.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/repositories/:path*",
    "/rules/:path*",
    "/events/:path*",
    "/logs/:path*",
    "/settings/:path*",
  ],
};
