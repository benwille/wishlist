import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { exchangeExclusions } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { userId1?: number; userId2?: number };
  if (!body.userId1 || !body.userId2) return NextResponse.json({ error: "Both users required" }, { status: 400 });

  // Store in consistent order
  const [u1, u2] = body.userId1 < body.userId2 ? [body.userId1, body.userId2] : [body.userId2, body.userId1];

  await db.insert(exchangeExclusions).values({ groupId: Number(id), userId1: u1, userId2: u2 }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { id?: number };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(exchangeExclusions).where(eq(exchangeExclusions.id, body.id));
  return NextResponse.json({ ok: true });
}
