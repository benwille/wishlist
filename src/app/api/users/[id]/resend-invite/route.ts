import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { inviteEmailHtml } from "@/lib/email/templates/invite";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await validateSession(db, sessionId);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const [user] = await db.select().from(users).where(eq(users.id, Number(id))).limit(1);
  if (!user || !user.inviteToken) {
    return NextResponse.json({ error: "No pending invite for this user" }, { status: 400 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "User has no email address" }, { status: 400 });
  }

  // Refresh the expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await db.update(users).set({
    inviteExpiresAt: expiresAt.toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));

  const inviteUrl = `https://theholidaywishlist.com/invite/${user.inviteToken}`;
  await sendEmail(
    env.EMAIL_WORKER,
    user.email,
    "You're invited to Wishlist",
    inviteEmailHtml(user.firstName, inviteUrl),
  );

  return NextResponse.json({ ok: true });
}
