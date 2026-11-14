import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fs_session";
const ADMIN_COOKIE = "fs_admin";
const PUBLIC_PATHS = ["/login", "/forgot-password", "/privacy", "/terms"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Runs before every page and API request.
 *
 * - API requests that change something must come from this site: a request
 *   whose Origin header names another site is refused. Together with
 *   SameSite cookies this stops other websites acting with a visitor's session.
 * - Signed-out visitors are sent to the sign-in page. This only checks that a
 *   session cookie is present; every API route verifies the session itself.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    if (!SAFE_METHODS.has(request.method) && origin && !sameHost(origin, request)) {
      return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const isLogin = pathname.startsWith("/admin/login");
    if (!request.cookies.has(ADMIN_COOKIE) && !isLogin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  const signedIn = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (!signedIn && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

function sameHost(origin: string, request: NextRequest): boolean {
  try {
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
