import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-safe session gate using the JWT cookie only (no Prisma / Node-only imports).
 * Server layouts and route handlers still use `auth()` from `@/auth` for full session data.
 * TODO: align cookie options with Auth.js defaults if you customize session token names.
 */
export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("middleware: missing AUTH_SECRET (or NEXTAUTH_SECRET)");
    return NextResponse.next();
  }

  const token = await getToken({ req, secret });
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/sessions") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/analyses");

  if (!token && isProtected) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/sessions/:path*", "/users/:path*", "/analyses/:path*", "/login"],
};
