import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { sendPushToUsers } from "@/lib/push/send";
import { pickClaimCopy } from "@/lib/push/copy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await validateSession(db, sessionId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [item] = await db.select().from(items).where(eq(items.id, Number(id))).limit(1);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Can't claim your own items
  if (item.userId === user.id) {
    return NextResponse.json({ error: "Can't claim your own item" }, { status: 403 });
  }

  const body = (await request.json()) as { action: "claim" | "unclaim" | "purchase" };

  let shouldNotify = false;

  if (body.action === "claim") {
    if (item.claimedBy && item.claimedBy !== user.id) {
      return NextResponse.json({ error: "Already claimed by someone else" }, { status: 409 });
    }
    // Only notify if this is a new claim (not a duplicate from the same user)
    if (item.claimedBy !== user.id) shouldNotify = true;
    await db.update(items).set({ claimedBy: user.id }).where(eq(items.id, item.id));
  } else if (body.action === "unclaim") {
    if (item.claimedBy !== user.id) {
      return NextResponse.json({ error: "You haven't claimed this" }, { status: 403 });
    }
    await db.update(items).set({ claimedBy: null, purchased: 0 }).where(eq(items.id, item.id));
  } else if (body.action === "purchase") {
    // Notify only on first-time claim; don't double-notify if already claimed
    if (!item.claimedBy) shouldNotify = true;
    await db.update(items).set({ claimedBy: user.id, purchased: 1 }).where(eq(items.id, item.id));
  }

  if (shouldNotify) {
    const { variant, copy } = pickClaimCopy();
    await sendPushToUsers(db, env.PUSH_WORKER, [item.userId], copy, { type: "claim", variant });
  }

  return NextResponse.json({ ok: true });
}
