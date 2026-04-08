import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    password?: string | null;
    isAdmin?: boolean;
  };

  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json({ error: "First and last name required" }, { status: 400 });
  }

  let passwordHash: string | null = null;
  if (body.password) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    passwordHash = await hashPassword(body.password);
  }

  const [created] = await db.insert(users).values({
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email: body.email?.trim()?.toLowerCase() || null,
    passwordHash,
    isAdmin: body.isAdmin ? 1 : 0,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}
