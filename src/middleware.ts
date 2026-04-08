import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/invite/", "/share/", "/api/auth/", "/_next/", "/favicon.ico", "/manifest.json", "/icons/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get("session_id")?.value;

  if (!sessionId) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Session validation happens in server components/API routes (need D1 access)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"],
};
