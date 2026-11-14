import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fs_session";
const ADMIN_COOKIE = "fs_admin";
const PUBLIC_PATHS = ["/login", "/forgot-password", "/privacy", "/terms"];

/**
 * Sends signed-out visitors to the sign-in page. This only checks that a
 * session cookie is present; every API route verifies the session itself.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
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

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
