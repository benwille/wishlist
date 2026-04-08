import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { exchangeGroups } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  await db.update(exchangeGroups).set({ name: body.name.trim() }).where(eq(exchangeGroups.id, Number(id)));
  return NextResponse.json({ ok: true });
}
