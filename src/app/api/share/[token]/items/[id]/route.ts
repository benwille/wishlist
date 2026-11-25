import { and, eq, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { pickClaimCopy } from "@/lib/push/copy";
import { sendPushToUsers } from "@/lib/push/send";
import { assertSameOrigin, createGuest, getGuest, guestCookieName, jsonBody, limit, network, publicOwner, setGuestCookie, ShareError, shareError } from "@/lib/share/access";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    assertSameOrigin(request);
    const { token, id } = await params;
    const { env } = getCloudflareContext();
    const db = getDb(env.DB);
    const owner = await publicOwner(db, token);
    const body = await jsonBody(request);
    const action = body.action;
    if (action !== "claim" && action !== "purchase" && action !== "unclaim") throw new ShareError("Invalid action");
    const itemId = Number(id);
    if (!Number.isSafeInteger(itemId) || itemId < 1) throw new ShareError("Invalid gift");
    const [item] = await db.select().from(items).where(and(eq(items.id, itemId), eq(items.userId, owner.id))).limit(1);
    if (!item) throw new ShareError("Gift not found", 404);
    if (item.receivedAt !== null) throw new ShareError("This gift has already been received.", 409);
    const session = request.cookies.get(getSessionCookieName())?.value;
    const member = session ? await validateSession(db, session) : null;
    if (member?.id === owner.id) throw new ShareError("You can't claim a gift from your own list.", 403);
    let guest = await getGuest(db, owner.id, request.cookies.get(guestCookieName(owner.id))?.value);
    let newCookie: string | undefined;
    // Keep access to an earlier guest claim if this browser later signs in.
    const useMember = !!member && !(guest && item.claimedByGuest === guest.id);
    if (!useMember && !guest) {
      if (action !== "claim") throw new ShareError("Use your private recovery link to manage this claim.", 403);
      const created = await createGuest(db, env.DB, request, owner.id);
      guest = { id: created.id, listOwnerId: owner.id, email: null, mergedInto: null, createdAt: "" };
      newCookie = created.token;
    }
    const actorUser = useMember ? member!.id : null;
    const actorGuest = useMember ? null : guest!.id;
    const mine = item.claimedBy === actorUser && item.claimedByGuest === actorGuest;
    const taken = item.claimedBy !== null || item.claimedByGuest !== null;
    if (taken && !mine) throw new ShareError("Someone else has already claimed this gift.", 409);
    if (action !== "claim" && !mine) throw new ShareError("Claim this gift first.", 403);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    if (newCookie) setGuestCookie(response, owner.id, newCookie);
    if (mine && (action === "claim" || (action === "purchase" && item.purchased === 1))) return response;
    const actorKey = actorUser !== null ? `member:${actorUser}` : `guest:${actorGuest}`;
    await limit(env.DB, `public-actions:${actorKey}`, 60, 600);
    if (!taken) {
      await limit(env.DB, `public-claims:${actorKey}`, 12, 600);
      await limit(env.DB, `public-claims-network:${network(request)}`, 60, 600);
    }
    const [updated] = await db.update(items).set(action === "unclaim"
      ? { claimedBy: null, claimedByGuest: null, purchased: 0 }
      : { claimedBy: actorUser, claimedByGuest: actorGuest, purchased: action === "purchase" ? 1 : 0 })
      .where(and(eq(items.id, item.id), eq(items.userId, owner.id), isNull(items.receivedAt),
        sql`EXISTS (SELECT 1 FROM users WHERE id = ${owner.id} AND active = 1 AND share_token = ${token})`,
        item.claimedBy === null ? isNull(items.claimedBy) : eq(items.claimedBy, item.claimedBy),
        item.claimedByGuest === null ? isNull(items.claimedByGuest) : eq(items.claimedByGuest, item.claimedByGuest)))
      .returning({ id: items.id });
    if (!updated) {
      const [current] = await db.select().from(items).where(eq(items.id, item.id)).limit(1);
      if (current && current.receivedAt === null && current.claimedBy === actorUser && current.claimedByGuest === actorGuest &&
          (action === "claim" || (action === "purchase" && current.purchased === 1))) return response;
      throw new ShareError("This gift just changed. Refresh the list and try again.", 409);
    }
    if (!taken && action === "claim") {
      const { variant, copy } = pickClaimCopy();
      await sendPushToUsers(db, env.PUSH_WORKER, [owner.id], copy, { type: "claim", variant });
    }
    return response;
  } catch (error) { return shareError(error); }
}
