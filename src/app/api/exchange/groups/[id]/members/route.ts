import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { exchangeGroupMembers } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { userId?: number };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await db.insert(exchangeGroupMembers).values({ groupId: Number(id), userId: body.userId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { userId?: number };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await db.delete(exchangeGroupMembers).where(
    and(eq(exchangeGroupMembers.groupId, Number(id)), eq(exchangeGroupMembers.userId, body.userId))
  );
  return NextResponse.json({ ok: true });
}
