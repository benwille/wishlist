import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { guestAccessLinks, guestClaimants, items } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { ACCESS_MAX_AGE, SITE_ORIGIN, assertSameOrigin, getGuest, guestCookieName, hash, jsonBody, limit, network, publicOwner, randomToken, ShareError, shareError } from "@/lib/share/access";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const { env } = getCloudflareContext();
    const db = getDb(env.DB);
    const owner = await publicOwner(db, token);
    const body = await jsonBody(request);
    if (body.mode !== "save" && body.mode !== "recover" && body.mode !== "copy") throw new ShareError("Invalid request");
    const guest = await getGuest(db, owner.id, request.cookies.get(guestCookieName(owner.id))?.value);
    if (body.mode === "copy") {
      if (!guest) throw new ShareError("Claim a gift in this browser first.", 403);
      await limit(env.DB, `copy-access:${guest.id}`, 10, 3600);
      const key = randomToken();
      await db.insert(guestAccessLinks).values({ tokenHash: await hash(key), claimantId: guest.id, email: null, expiresAt: Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE });
      return NextResponse.json({ url: `${SITE_ORIGIN}/share/access/${key}` }, { headers: { "Cache-Control": "no-store" } });
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new ShareError("Enter a valid email address.");
    await limit(env.DB, `email-network:${network(request)}`, 10, 3600);
    await limit(env.DB, `email-minute:${email}`, 1, 60);
    await limit(env.DB, `email-hour:${email}`, 3, 3600);
    let claimantId: string | undefined;
    if (body.mode === "save") {
      if (!guest) throw new ShareError("Claim a gift in this browser first.", 403);
      if (guest.email && guest.email !== email) throw new ShareError("Use the email address you previously saved for these claims.");
      const [claim] = await db.select({ id: items.id }).from(items).where(and(eq(items.userId, owner.id), eq(items.claimedByGuest, guest.id))).limit(1);
      if (!claim) throw new ShareError("There are no guest claims to save in this browser.");
      claimantId = guest.id;
    } else {
      const [known] = await db.select({ id: guestClaimants.id }).from(guestClaimants)
        .where(and(eq(guestClaimants.listOwnerId, owner.id), eq(guestClaimants.email, email))).limit(1);
      claimantId = known?.id;
    }
    if (claimantId) {
      const key = randomToken();
      const tokenHash = await hash(key);
      await db.insert(guestAccessLinks).values({ tokenHash, claimantId, email, expiresAt: Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE });
      const url = `${SITE_ORIGIN}/share/access/${key}`;
      try {
        await sendEmail(env.EMAIL_WORKER, email, "Manage your Wishlist gift claims", `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:32px 16px">
            <h2 style="color:#059669">Your gift claims</h2>
            <p>Use this private link to manage your gift claims on another device.</p>
            <p><a href="${url}" style="display:inline-block;background:#059669;color:white;padding:12px 20px;border-radius:8px">Manage my gifts</a></p>
            <p>Keep this link private. It gives access to your claims, and works for 90 days.</p>
            <p>Open it once to confirm this email for future recovery. No account or password is needed.</p>
            <p>If you didn't request this email, you can ignore it. This doesn't sign you up for marketing.</p>
          </div>`);
      } catch {
        await db.delete(guestAccessLinks).where(eq(guestAccessLinks.tokenHash, tokenHash));
        throw new ShareError("Couldn't send the email. Your claims are still saved in this browser; please try again later.", 503);
      }
    }
    return NextResponse.json({ ok: true, message: body.mode === "save"
      ? "Check your inbox and spam folder. Open the private link to confirm recovery for your claims."
      : "If that email has saved claims on this wishlist, we've sent a private access link. Check your inbox and spam folder." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return shareError(error); }
}
