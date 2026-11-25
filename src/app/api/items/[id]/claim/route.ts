import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { sendPushToUsers } from "@/lib/push/send";
import { pickClaimCopy } from "@/lib/push/copy";
import { getVisibleUserIds } from "@/lib/db/queries";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await validateSession(db, sessionId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("action" in body) ||
      (body.action !== "claim" && body.action !== "unclaim" && body.action !== "purchase")) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visibleIds = await getVisibleUserIds(db, user.id, user.isAdmin);
  if (!visibleIds.includes(item.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Can't claim your own items
  if (item.userId === user.id) {
    return NextResponse.json({ error: "Can't claim your own item" }, { status: 403 });
  }

  if (item.receivedAt !== null) {
    return NextResponse.json({ error: "This gift has already been received" }, { status: 409 });
  }

  if (item.claimedByGuest !== null) {
    return NextResponse.json({ error: "Already claimed by someone else" }, { status: 409 });
  }

  if (body.action === "unclaim") {
    if (item.claimedBy !== user.id) {
      return NextResponse.json({ error: "You haven't claimed this" }, { status: 403 });
    }
  } else if (item.claimedBy !== null && item.claimedBy !== user.id) {
    return NextResponse.json({ error: "Already claimed by someone else" }, { status: 409 });
  } else if (item.claimedBy === user.id && (body.action === "claim" || item.purchased === 1)) {
    // Retrying a successful action must not reset a purchase or notify twice.
    return NextResponse.json({ ok: true });
  }

  const [updated] = await db.update(items)
    .set(body.action === "unclaim"
      ? { claimedBy: null, purchased: 0 }
      : body.action === "purchase"
        ? { claimedBy: user.id, purchased: 1 }
        : { claimedBy: user.id })
    .where(and(
      eq(items.id, item.id),
      isNull(items.receivedAt),
      isNull(items.claimedByGuest),
      item.claimedBy === null ? isNull(items.claimedBy) : eq(items.claimedBy, user.id),
    ))
    .returning({ id: items.id });

  if (!updated) {
    // Another request may have claimed, released, or received this gift since
    // we read it. Never overwrite that change with a stale request.
    const [current] = await db.select().from(items).where(eq(items.id, item.id)).limit(1);
    if (current && current.receivedAt === null && current.claimedByGuest === null && current.claimedBy === user.id &&
        (body.action === "claim" || (body.action === "purchase" && current.purchased === 1))) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "This gift changed. Please refresh and try again." }, { status: 409 });
  }

  if (body.action !== "unclaim" && item.claimedBy === null) {
    const { variant, copy } = pickClaimCopy();
    await sendPushToUsers(db, env.PUSH_WORKER, [item.userId], copy, { type: "claim", variant });
  }

  return NextResponse.json({ ok: true });
}
