import webpush from "web-push";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = request.headers.get("X-Internal-Auth");
    if (authHeader !== env.INTERNAL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { subscriptions, payload } = await request.json();

      webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY,
      );

      const results = await Promise.allSettled(
        subscriptions.map((sub) =>
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          ),
        ),
      );

      // Collect endpoints that returned 410 Gone (unsubscribed)
      const gone = [];
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "rejected" && results[i].reason?.statusCode === 410) {
          gone.push(subscriptions[i].endpoint);
        }
      }

      const sent = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected" && r.reason?.statusCode !== 410).length;

      return Response.json({ sent, failed, gone });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};
