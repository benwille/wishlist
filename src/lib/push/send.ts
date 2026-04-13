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
