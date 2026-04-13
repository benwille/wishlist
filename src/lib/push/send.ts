import { inArray } from "drizzle-orm";
import { pushSubscriptions } from "@/lib/db/schema";
import type { getDb } from "@/lib/db";

const INTERNAL_SECRET = "wishlist-push-internal-2026";

type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type PushResult = {
  sent: number;
  failed: number;
  gone: string[];
};

export async function sendPush(
  pushWorker: Fetcher,
  subscriptions: Subscription[],
  payload: PushPayload,
): Promise<PushResult> {
  const res = await pushWorker.fetch("https://push-worker/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Auth": INTERNAL_SECRET,
    },
    body: JSON.stringify({ subscriptions, payload }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Push send failed: ${data.error || res.statusText}`);
  }

  return res.json() as Promise<PushResult>;
}

/**
 * Send a push to specific users by ID. Fetches their subscriptions, tags the
 * payload URL with notification metadata for click tracking, and cleans up
 * any stale (410 Gone) subscriptions.
 *
 * Non-throwing: notification failures should never break the user action that
 * triggered them. Errors are swallowed after logging.
 */
export async function sendPushToUsers(
  db: ReturnType<typeof getDb>,
  pushWorker: Fetcher,
  userIds: number[],
  payload: PushPayload,
  meta: { type: string; variant?: string },
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    if (subs.length === 0) return;

    // Tag URL with notification metadata for click tracking
    const url = payload.url ? addNotificationParams(payload.url, meta) : undefined;

    const result = await sendPush(
      pushWorker,
      subs.map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
      { ...payload, url },
    );

    if (result.gone.length > 0) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, result.gone));
    }
  } catch (err) {
    console.error("Push send failed:", err);
  }
}

function addNotificationParams(url: string, meta: { type: string; variant?: string }): string {
  const separator = url.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ n_type: meta.type });
  if (meta.variant) params.set("n_variant", meta.variant);
  return `${url}${separator}${params.toString()}`;
}
