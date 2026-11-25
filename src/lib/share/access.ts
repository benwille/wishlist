import { and, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/db";
import { guestClaimants, guestSessions, users } from "@/lib/db/schema";

export const GUEST_MAX_AGE = 365 * 24 * 60 * 60;
export const ACCESS_MAX_AGE = 90 * 24 * 60 * 60;
export const SITE_ORIGIN = "https://theholidaywishlist.com";

export class ShareError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message); }
}

export function shareError(error: unknown) {
  if (!(error instanceof ShareError)) console.error("Public wishlist action failed");
  return NextResponse.json({ error: error instanceof ShareError ? error.message : "Couldn't complete that request. Please try again." }, {
    status: error instanceof ShareError ? error.status : 500,
    headers: {
      "Cache-Control": "no-store",
      ...(error instanceof ShareError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}),
    },
  });
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) throw new ShareError("Please open this wishlist directly to continue.", 403);
}

export async function jsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ShareError("Invalid request");
  return value as Record<string, unknown>;
}

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function publicOwner(db: Database, token: string) {
  const [owner] = await db.select({ id: users.id, firstName: users.firstName, shareToken: users.shareToken })
    .from(users).where(and(eq(users.shareToken, token), eq(users.active, 1))).limit(1);
  if (!owner) throw new ShareError("This shared wishlist is unavailable.", 404);
  return owner;
}

export function guestCookieName(ownerId: number) { return `wishlist_guest_${ownerId}`; }

export function setGuestCookie(response: NextResponse, ownerId: number, token: string) {
  response.cookies.set(guestCookieName(ownerId), token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: GUEST_MAX_AGE,
  });
}

export async function getGuest(db: Database, ownerId: number, token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await db.select({ claimant: guestClaimants }).from(guestSessions)
    .innerJoin(guestClaimants, eq(guestSessions.claimantId, guestClaimants.id))
    .where(and(eq(guestSessions.tokenHash, await hash(token)), gt(guestSessions.expiresAt, Math.floor(Date.now() / 1000)), eq(guestClaimants.listOwnerId, ownerId)))
    .limit(1);
  if (!row) return null;
  if (!row.claimant.mergedInto) return row.claimant;
  const [canonical] = await db.select().from(guestClaimants)
    .where(and(eq(guestClaimants.id, row.claimant.mergedInto), eq(guestClaimants.listOwnerId, ownerId))).limit(1);
  return canonical ?? null;
}

// Atomic counters are shared by every Worker instance. No raw IP addresses,
// emails, or access tokens are stored as limiter keys.
export async function limit(binding: D1Database, key: string, maximum: number, seconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const keyHash = await hash(key);
  const results = await binding.batch([
    binding.prepare("DELETE FROM public_rate_limits WHERE expires_at <= ?").bind(now),
    binding.prepare(`INSERT INTO public_rate_limits (key, window_start, count, expires_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = count + 1
      WHERE count < ? RETURNING key`)
      .bind(keyHash, now, now + seconds, maximum),
  ]);
  if (!results[1].results.length) {
    const row = await binding.prepare("SELECT expires_at FROM public_rate_limits WHERE key = ?").bind(keyHash).first<{ expires_at: number }>();
    throw new ShareError("Too many requests. Please wait a little before trying again.", 429, Math.max(1, (row?.expires_at ?? now + seconds) - now));
  }
}

export function network(request: NextRequest) { return request.headers.get("cf-connecting-ip") || "unknown"; }

export async function createGuest(db: Database, binding: D1Database, request: NextRequest, ownerId: number) {
  await limit(binding, `guest-create:${ownerId}:${network(request)}`, 20, 3600);
  const id = crypto.randomUUID();
  const token = randomToken();
  await db.batch([
    db.insert(guestClaimants).values({ id, listOwnerId: ownerId }),
    db.insert(guestSessions).values({ tokenHash: await hash(token), claimantId: id, expiresAt: Math.floor(Date.now() / 1000) + GUEST_MAX_AGE }),
  ]);
  return { id, token };
}
