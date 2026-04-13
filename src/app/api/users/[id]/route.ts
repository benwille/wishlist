import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import {
  users,
  items,
  sessions,
  magicLinks,
  exchangeGroupMembers,
  exchangeExclusions,
  exchangeAssignments,
} from "@/lib/db/schema";
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

async function checkDeleteEligibility(db: ReturnType<typeof getDb>, userId: number) {
  const assignments = await db
    .select({ id: exchangeAssignments.id })
    .from(exchangeAssignments)
    .where(or(eq(exchangeAssignments.giverId, userId), eq(exchangeAssignments.receiverId, userId)))
    .limit(1);

  if (assignments.length > 0) {
    return { eligible: false, reason: "This user has exchange history and can't be deleted. Deactivate instead." };
  }

  const claims = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.claimedBy, userId))
    .limit(1);

  if (claims.length > 0) {
    return { eligible: false, reason: "This user has claimed items on other lists and can't be deleted. Deactivate instead." };
  }

  return { eligible: true };
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await validateSession(db, sessionId);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  if (admin.id === userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const check = checkDeleteEligibility(db, userId);

  // ?check=1 — just return eligibility without deleting
  if (request.nextUrl.searchParams.get("check") === "1") {
    const result = await check;
    if (!result.eligible) {
      return NextResponse.json({ eligible: false, reason: result.reason }, { status: 409 });
    }
    return NextResponse.json({ eligible: true });
  }

  // Actual delete — re-check eligibility to prevent race conditions
  const result = await check;
  if (!result.eligible) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(magicLinks).where(eq(magicLinks.userId, userId));
  await db.delete(items).where(eq(items.userId, userId));
  await db.delete(exchangeGroupMembers).where(eq(exchangeGroupMembers.userId, userId));
  await db.delete(exchangeExclusions).where(or(eq(exchangeExclusions.userId1, userId), eq(exchangeExclusions.userId2, userId)));
  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
