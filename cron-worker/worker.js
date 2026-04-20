const INTERNAL_SECRET = "wishlist-push-internal-2026";
const LOW_LIST_THRESHOLD = 3;
const LINK_CHECK_TIMEOUT_MS = 10_000;
const LINK_CHECK_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default {
  async scheduled(event, env, ctx) {
    // event.cron is the cron expression that triggered this
    const task = cronToTask(event.cron);
    if (!task) {
      console.warn("Unknown cron:", event.cron);
      return;
    }
    ctx.waitUntil(runTask(task, env));
  },

  // For manual testing — hit the worker directly to run a task
  async fetch(request, env) {
    const authHeader = request.headers.get("X-Internal-Auth");
    if (authHeader !== INTERNAL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const task = url.searchParams.get("task");
    if (task !== "link_check" && task !== "low_list") {
      return Response.json({ error: "?task= link_check | low_list" }, { status: 400 });
    }

    const result = await runTask(task, env);
    return Response.json(result);
  },
};

function cronToTask(cron) {
  // See wrangler.toml — we schedule two distinct weekly crons
  if (cron === "0 15 * * 1") return "link_check";
  if (cron === "0 15 * * 3") return "low_list";
  return null;
}

async function runTask(task, env) {
  if (task === "link_check") return runLinkCheck(env);
  if (task === "low_list") return runLowListCheck(env);
}

// --- Link check ----------------------------------------------------------

async function runLinkCheck(env) {
  // Only check items that are unclaimed and have a link
  const { results: items } = await env.DB.prepare(
    `SELECT id, user_id AS userId, name, link
     FROM items
     WHERE link IS NOT NULL AND link != '' AND claimed_by IS NULL`
  ).all();

  let checked = 0;
  let broken = 0;
  let notified = 0;

  for (const item of items) {
    checked++;
    const status = await checkLink(item.link);
    if (status !== "broken") continue;

    broken++;

    // Fire a push to the item's owner
    const subs = await getSubscriptionsForUser(env, item.userId);
    if (subs.length === 0) continue;

    const url = `/my-list?highlight=${item.id}&n_type=broken_link`;
    const sent = await sendPush(env, subs, {
      title: "A link on your list is broken",
      body: `The link for "${item.name}" isn't working. Tap to fix it.`,
      url,
    });
    if (sent) notified++;
  }

  return { task: "link_check", checked, broken, notified };
}

// Returns "ok" | "broken" | "unknown". Only "broken" triggers a notification —
// anything ambiguous (bot walls, rate limits, timeouts) is "unknown" so we
// don't spam owners about perfectly good links.
async function checkLink(url) {
  if (!/^https?:\/\//.test(url)) return "broken";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
  const headers = {
    "User-Agent": LINK_CHECK_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    let res = await fetch(url, { method: "HEAD", headers, signal: controller.signal, redirect: "follow" });
    // Many sites reject HEAD — retry ambiguous responses with GET before deciding
    if (res.status === 405 || res.status === 403 || res.status === 429 || res.status >= 500) {
      res = await fetch(url, { method: "GET", headers, signal: controller.signal, redirect: "follow" });
    }
    if (res.status === 404 || res.status === 410) return "broken";
    if (res.status >= 200 && res.status < 400) return "ok";
    return "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

// --- Low list check ------------------------------------------------------

async function runLowListCheck(env) {
  // Count unclaimed items per active user (skip pending-invite users too)
  const { results: rows } = await env.DB.prepare(
    `SELECT u.id AS userId,
            COUNT(CASE WHEN i.claimed_by IS NULL THEN 1 END) AS unclaimed
     FROM users u
     LEFT JOIN items i ON i.user_id = u.id
     WHERE u.active = 1 AND u.invite_token IS NULL
     GROUP BY u.id
     HAVING unclaimed < ?`
  ).bind(LOW_LIST_THRESHOLD).all();

  let notified = 0;
  for (const row of rows) {
    const subs = await getSubscriptionsForUser(env, row.userId);
    if (subs.length === 0) continue;

    const count = Number(row.unclaimed);
    const body = count === 0
      ? "You have no unclaimed items. Add some ideas so people know what to get you!"
      : `Only ${count} unclaimed item${count === 1 ? "" : "s"} left. Add a few more ideas.`;

    const sent = await sendPush(env, subs, {
      title: "Your list is getting thin",
      body,
      url: "/my-list?n_type=low_list",
    });
    if (sent) notified++;
  }

  return { task: "low_list", checked: rows.length, notified };
}

// --- Helpers -------------------------------------------------------------

async function getSubscriptionsForUser(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
  ).bind(userId).all();
  return results;
}

async function sendPush(env, subscriptions, payload) {
  try {
    const res = await env.PUSH_WORKER.fetch("https://push-worker/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth": INTERNAL_SECRET,
      },
      body: JSON.stringify({ subscriptions, payload }),
    });

    if (!res.ok) {
      console.error("Push send failed:", res.status);
      return false;
    }

    const data = await res.json();
    // Clean up expired subscriptions
    if (data.gone?.length) {
      const placeholders = data.gone.map(() => "?").join(",");
      await env.DB.prepare(
        `DELETE FROM push_subscriptions WHERE endpoint IN (${placeholders})`
      ).bind(...data.gone).run();
    }
    return data.sent > 0;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}
