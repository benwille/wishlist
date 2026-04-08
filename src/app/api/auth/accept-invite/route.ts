import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const body = (await request.json()) as {
    token?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  };

  if (!body.token || !body.firstName?.trim() || !body.lastName?.trim() || !body.password) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  if (body.password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.inviteToken, body.token)).limit(1);

  if (!user) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  if (user.inviteExpiresAt && new Date(user.inviteExpiresAt) < new Date()) {
    return NextResponse.json({ error: "Invite link has expired" }, { status: 410 });
  }

  const passwordHash = await hashPassword(body.password);

  await db.update(users).set({
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    passwordHash,
    active: 1,
    inviteToken: null,
    inviteExpiresAt: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));

  // Log them in
  const { sessionId, expires } = await createSession(db, user.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session_id", sessionId, sessionCookieOptions(expires));

  return response;
}
