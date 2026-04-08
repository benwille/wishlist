import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = await validateSession(db, sessionId);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  await db.update(users).set({ shareToken: token, updatedAt: new Date().toISOString() }).where(eq(users.id, sessionUser.id));

  const url = `https://theholidaywishlist.com/share/${token}`;
  return NextResponse.json({ url, token });
}
