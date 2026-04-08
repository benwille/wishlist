import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { destroySession, getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(getSessionCookieName())?.value;

  if (sessionId) {
    try {
      const { env } = getCloudflareContext();
      const db = getDb(env.DB);
      await destroySession(db, sessionId);
    } catch {
      // Session cleanup failure is non-critical
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(getSessionCookieName());

  return response;
}
