import { and, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { guestAccessLinks, guestClaimants, guestSessions, users } from "@/lib/db/schema";
import { GUEST_MAX_AGE, assertSameOrigin, hash, limit, network, randomToken, setGuestCookie, ShareError } from "@/lib/share/access";

const headers = {
  "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
function document(message: string, button = false, status = 200) {
  // This standalone response intentionally has no analytics, third-party assets,
  // or scripts. Email scanners can GET it without creating a session or claim.
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manage your gifts</title></head><body style="font:16px system-ui,sans-serif;max-width:480px;margin:64px auto;padding:24px;color:#1c1917"><h1>Manage your gifts</h1><p>${message}</p>${button ? '<form method="post"><button style="font:inherit;background:#059669;color:white;border:0;border-radius:8px;padding:12px 20px;cursor:pointer">Open my gift claims</button></form>' : ''}</body></html>`, { status, headers });
}

export function GET() { return document("Continue to open your saved gift claims in this browser. Keep this link private.", true); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    assertSameOrigin(request);
    const { key } = await params;
    if (!/^[a-f0-9]{64}$/.test(key)) throw new ShareError("This access link is invalid or expired. Return to the original wishlist and request another email.", 410);
    const { env } = getCloudflareContext();
    const db = getDb(env.DB);
    await limit(env.DB, `open-access:${network(request)}`, 30, 600);
    const [link] = await db.select({ access: guestAccessLinks, claimant: guestClaimants, owner: users })
      .from(guestAccessLinks).innerJoin(guestClaimants, eq(guestAccessLinks.claimantId, guestClaimants.id))
      .innerJoin(users, eq(guestClaimants.listOwnerId, users.id))
      .where(and(eq(guestAccessLinks.tokenHash, await hash(key)), gt(guestAccessLinks.expiresAt, Math.floor(Date.now() / 1000)), eq(users.active, 1))).limit(1);
    if (!link?.owner.shareToken) throw new ShareError("This access link is expired or sharing has been turned off. Return to the original wishlist or ask its owner for help.", 410);
    if (link.access.email) {
      const [claimant] = await db.select().from(guestClaimants).where(eq(guestClaimants.id, link.claimant.mergedInto || link.claimant.id)).limit(1);
      if (claimant?.email && claimant.email !== link.access.email) throw new ShareError("These claims were saved with a different email. Request a new access link from the wishlist.", 410);
    }
    const sessionToken = randomToken();
    const sessionHash = await hash(sessionToken);
    const expires = Math.floor(Date.now() / 1000) + GUEST_MAX_AGE;
    if (link.access.email) {
      const email = link.access.email;
      // Resolve concurrent email confirmations and merge same-person guest
      // claims inside one D1 transaction. Typing an email alone grants nothing.
      const canonical = "SELECT id FROM guest_claimants WHERE list_owner_id = ? AND email = ?";
      const results = await env.DB.batch([
        env.DB.prepare(`UPDATE guest_claimants SET email = ? WHERE id = ? AND email IS NULL AND merged_into IS NULL AND NOT EXISTS (${canonical})`)
          .bind(email, link.claimant.id, link.owner.id, email),
        env.DB.prepare(`UPDATE items SET claimed_by_guest = (${canonical}) WHERE user_id = ? AND claimed_by_guest = ? AND claimed_by_guest != (${canonical})
          AND EXISTS (SELECT 1 FROM guest_claimants WHERE id = ? AND (email IS NULL OR email = ?))`)
          .bind(link.owner.id, email, link.owner.id, link.claimant.id, link.owner.id, email, link.claimant.id, email),
        env.DB.prepare(`UPDATE guest_claimants SET merged_into = (${canonical}) WHERE id = ? AND email IS NULL AND merged_into IS NULL AND id != (${canonical})`)
          .bind(link.owner.id, email, link.claimant.id, link.owner.id, email),
        env.DB.prepare(`INSERT INTO guest_sessions (token_hash, claimant_id, expires_at)
          SELECT ?, target.id, ? FROM guest_claimants AS target WHERE target.list_owner_id = ? AND target.email = ?
          AND EXISTS (SELECT 1 FROM guest_claimants AS source WHERE source.id = ? AND (source.email IS NULL OR source.email = ?)
            AND (source.merged_into IS NULL OR source.merged_into = target.id)) RETURNING token_hash`)
          .bind(sessionHash, expires, link.owner.id, email, link.claimant.id, email),
      ]);
      if (!results[3].results.length) throw new ShareError("These claims were just updated. Request a new access link from the wishlist.", 410);
    } else {
      await db.insert(guestSessions).values({ tokenHash: sessionHash, claimantId: link.claimant.mergedInto || link.claimant.id, expiresAt: expires });
    }
    const response = NextResponse.redirect(new URL(`/share/${link.owner.shareToken}`, request.url), 303);
    setGuestCookie(response, link.owner.id, sessionToken);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const response = document(error instanceof ShareError ? error.message : "Couldn't open your saved claims. Please try again.", false, error instanceof ShareError ? error.status : 500);
    if (error instanceof ShareError && error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
}
