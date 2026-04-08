import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await validateSession(db, sessionId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    link?: string | null;
    priceRange?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(items)
    .set({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      link: body.link?.trim() || null,
      priceRange: body.priceRange?.trim() || null,
    })
    .where(and(eq(items.id, Number(id)), eq(items.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await validateSession(db, sessionId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(items).where(and(eq(items.id, Number(id)), eq(items.userId, user.id)));

  return NextResponse.json({ ok: true });
}
