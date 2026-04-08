import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { inviteEmailHtml } from "@/lib/email/templates/invite";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await validateSession(db, sessionId);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { firstName?: string; lastName?: string; email?: string };

  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Check if email already exists
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Generate invite token (7 day expiry)
  const inviteToken = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create user with no password, inactive until they accept
  const [created] = await db.insert(users).values({
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email,
    inviteToken,
    inviteExpiresAt: expiresAt.toISOString(),
    active: 0,
  }).returning();

  // Send invite email
  const inviteUrl = `https://theholidaywishlist.com/invite/${inviteToken}`;
  await sendEmail(
    env.EMAIL_WORKER,
    email,
    "You're invited to Wishlist",
    inviteEmailHtml(body.firstName.trim(), inviteUrl)
  );

  return NextResponse.json({ ok: true, userId: created.id }, { status: 201 });
}
