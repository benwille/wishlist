import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users, magicLinks } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmailHtml } from "@/lib/email/templates/magic-link";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const body = (await request.json()) as { email?: string; redirect?: string };
  const email = body.email?.trim()?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Always return success to avoid leaking which emails exist
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user && user.active) {
    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await db.insert(magicLinks).values({
      userId: user.id,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    const redirectParam = body.redirect ? `&redirect=${encodeURIComponent(body.redirect)}` : "";
    const loginUrl = `https://theholidaywishlist.com/api/auth/magic-link/verify?token=${token}${redirectParam}`;

    await sendEmail(
      env.EMAIL_WORKER,
      email,
      "Your Wishlist login link",
      magicLinkEmailHtml(user.firstName, loginUrl)
    );
  }

  // Always return ok
  return NextResponse.json({ ok: true });
}
