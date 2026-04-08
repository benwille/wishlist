import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    isAdmin?: boolean;
    active?: number;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.firstName !== undefined) updates.firstName = body.firstName.trim();
  if (body.lastName !== undefined) updates.lastName = body.lastName.trim();
  if (body.email !== undefined) updates.email = body.email?.trim()?.toLowerCase() || null;
  if (body.isAdmin !== undefined) updates.isAdmin = body.isAdmin ? 1 : 0;
  if (body.active !== undefined) updates.active = body.active;

  await db.update(users).set(updates).where(eq(users.id, Number(id)));

  return NextResponse.json({ ok: true });
}
