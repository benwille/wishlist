import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { assertSameOrigin, randomToken, shareError } from "@/lib/share/access";

export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); } catch (error) { return shareError(error); }
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = await validateSession(db, sessionId);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { action?: string } | null;
  const replace = body?.action === "replace";
  const [current] = await db.select({ shareToken: users.shareToken }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
  let token = current?.shareToken;
  if (!token || replace) {
    const candidate = randomToken();
    await db.update(users).set({ shareToken: candidate, updatedAt: new Date().toISOString() })
      .where(replace ? eq(users.id, sessionUser.id) : and(eq(users.id, sessionUser.id), isNull(users.shareToken)));
    const [saved] = await db.select({ shareToken: users.shareToken }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
    token = saved.shareToken;
  }

  const url = `https://theholidaywishlist.com/share/${token}`;
  return NextResponse.json({ url, token });
}

export async function DELETE(request: NextRequest) {
  try { assertSameOrigin(request); } catch (error) { return shareError(error); }
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  const user = sessionId ? await validateSession(db, sessionId) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.update(users).set({ shareToken: null, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
