import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
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

  const [created] = await db.insert(items).values({
    userId: user.id,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    link: body.link?.trim() || null,
    priceRange: body.priceRange?.trim() || null,
    yearAdded: new Date().getFullYear(),
  }).returning();

  return NextResponse.json(created, { status: 201 });
}
