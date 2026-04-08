import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { magicLinks, users } from "@/lib/db/schema";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const token = request.nextUrl.searchParams.get("token");
  const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const now = new Date().toISOString();

  const [link] = await db
    .select({ id: magicLinks.id, userId: magicLinks.userId })
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.token, token),
        eq(magicLinks.used, 0),
        gt(magicLinks.expiresAt, now)
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  // Check user is active
  const [user] = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);
  if (!user || !user.active) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  // Mark token as used
  await db.update(magicLinks).set({ used: 1 }).where(eq(magicLinks.id, link.id));

  // Create session
  const { sessionId, expires } = await createSession(db, user.id);

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set("session_id", sessionId, sessionCookieOptions(expires));

  return response;
}
