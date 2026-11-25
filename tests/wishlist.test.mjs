import assert from "node:assert/strict";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createElement } from "react";
import { build } from "esbuild";
import { NextRequest } from "next/server.js";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = await mkdtemp(join(root, "tests", ".wishlist-test-"));
after(() => rm(output, { recursive: true, force: true }));

// Compile the actual handlers and page. Only the Cloudflare environment is
// substituted; authentication, Drizzle queries, and push handling run normally.
await build({
  absWorkingDir: root,
  entryPoints: {
    claim: "src/app/api/items/[id]/claim/route.ts",
    share: "src/app/share/[token]/page.tsx",
    publicClaim: "src/app/api/share/[token]/items/[id]/route.ts",
    publicAccess: "src/app/api/share/[token]/access/route.ts",
    openAccess: "src/app/share/access/[key]/route.ts",
    shareControl: "src/app/api/users/me/share-link/route.ts",
    shareTools: "src/lib/share/access.ts",
  },
  outdir: output,
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [{
    name: "test-cloudflare-context",
    setup(builder) {
      builder.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({
        path: "cloudflare-context", namespace: "test",
      }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
        contents: "export function getCloudflareContext() { return globalThis.__wishlistTestContext; }",
      }));
      builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "test-headers" }));
      builder.onLoad({ filter: /.*/, namespace: "test-headers" }, () => ({ contents: "export async function cookies() { return globalThis.__wishlistTestCookies; }" }));
    },
  }],
});

const require = createRequire(import.meta.url);
const { POST } = require(join(output, "claim.cjs"));
const { default: SharePage } = require(join(output, "share.cjs"));
const { POST: publicClaim } = require(join(output, "publicClaim.cjs"));
const { POST: publicAccess } = require(join(output, "publicAccess.cjs"));
const { GET: openAccessGet, POST: openAccess } = require(join(output, "openAccess.cjs"));
const { POST: shareControl, DELETE: disableSharing } = require(join(output, "shareControl.cjs"));
const { hash, limit } = require(join(output, "shareTools.cjs"));
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime.js");
const migrations = await Promise.all(
  (await readdir(join(root, "drizzle/migrations")))
    .filter((name) => name.endsWith(".sql")).sort()
    .map((name) => readFile(join(root, "drizzle/migrations", name), "utf8")),
);

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const migration of migrations) sqlite.exec(migration);
  sqlite.exec(`
    INSERT INTO users (id, first_name, last_name, share_token, created_at, updated_at)
    VALUES (1, 'Owner', 'Test', 'public-list', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (2, 'Friend', 'Test', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (3, 'Other', 'Test', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (4, 'Outsider', 'Test', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO exchange_groups (id, name, created_at) VALUES (1, 'Family', CURRENT_TIMESTAMP);
    INSERT INTO exchange_group_members (group_id, user_id) VALUES (1, 1), (1, 2), (1, 3);
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES ('session-1', 1, '2999-01-01', CURRENT_TIMESTAMP),
      ('session-2', 2, '2999-01-01', CURRENT_TIMESTAMP),
      ('session-3', 3, '2999-01-01', CURRENT_TIMESTAMP),
      ('session-4', 4, '2999-01-01', CURRENT_TIMESTAMP);
    INSERT INTO items (id, user_id, name, year_added, created_at)
    VALUES (1, 1, 'Available gift', 2026, CURRENT_TIMESTAMP);
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (1, 'https://push.invalid/subscription', 'key', 'auth', CURRENT_TIMESTAMP);
  `);

  const state = { sqlite, notifications: [], emails: [], beforeWrite: null };
  // D1's prepared-statement interface backed by real SQLite. This exercises
  // the production SQL, including conditional UPDATE ... RETURNING statements.
  function prepare(sql, parameters = []) {
    return {
      sql, parameters,
      bind: (...values) => prepare(sql, values),
      async raw() {
        if (/^update "items"/i.test(sql) && state.beforeWrite) {
          const hook = state.beforeWrite;
          state.beforeWrite = null;
          await hook();
        }
        const statement = sqlite.prepare(sql);
        statement.setReturnArrays(true);
        return statement.all(...parameters);
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...parameters) };
      },
      async run() {
        return { success: true, meta: sqlite.prepare(sql).run(...parameters) };
      },
      async first() { return sqlite.prepare(sql).get(...parameters) ?? null; },
    };
  }
  const binding = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map(({ sql, parameters }) => {
          const statement = sqlite.prepare(sql);
          const rows = statement.columns().length ? statement.all(...parameters) : [];
          if (!statement.columns().length) statement.run(...parameters);
          return { success: true, results: rows, meta: {} };
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  globalThis.__wishlistTestCookies = new Map();
  globalThis.__wishlistTestContext = {
    env: {
      DB: binding,
      EMAIL_WORKER: { async fetch(_url, options) { state.emails.push(JSON.parse(options.body)); return Response.json({ ok: true }); } },
      PUSH_WORKER: {
        async fetch(_url, options) {
          state.notifications.push(JSON.parse(options.body));
          return Response.json({ sent: 1, failed: 0, gone: [] });
        },
      },
    },
  };
  state.item = () => sqlite.prepare("SELECT claimed_by, purchased, received_at FROM items WHERE id = 1").get();
  state.binding = binding;
  state.history = () => sqlite.prepare("SELECT * FROM claim_history ORDER BY id").all();
  state.addGift = (id) => sqlite.prepare("INSERT INTO items (id,user_id,name,year_added,created_at) VALUES (?,1,?,2026,CURRENT_TIMESTAMP)").run(id, `Gift ${id}`);
  return state;
}

function renderPage(element) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {} } }, element));
}

function act(userId, action, { id = "1", rawBody } = {}) {
  return POST(new NextRequest(`https://wishlist.test/api/items/${id}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { Cookie: `session_id=session-${userId}` } : {}),
    },
    body: rawBody ?? JSON.stringify({ action }),
  }), { params: Promise.resolve({ id }) });
}

test("a shopper can claim, purchase, and release their own gift; notify only once", async (t) => {
  const state = fixture(t);
  for (const action of ["claim", "claim", "purchase", "purchase", "claim"]) {
    assert.equal((await act(2, action)).status, 200);
  }
  assert.equal(state.item().claimed_by, 2);
  assert.equal(state.item().purchased, 1);
  assert.equal(state.notifications.length, 1);
  assert.equal((await act(2, "unclaim")).status, 200);
  assert.equal(state.item().claimed_by, null);
  assert.equal(state.item().purchased, 0);
});

test("purchase cannot replace another shopper's claim, even via a direct request", async (t) => {
  const state = fixture(t);
  assert.equal((await act(2, "claim")).status, 200);
  assert.equal((await act(3, "purchase")).status, 409);
  assert.equal((await act(3, "claim")).status, 409);
  assert.equal((await act(3, "unclaim")).status, 403);
  assert.equal(state.item().claimed_by, 2);
  assert.equal(state.item().purchased, 0);
  assert.equal(state.notifications.length, 1);
});

test("direct purchase of an unclaimed gift still works and notifies once", async (t) => {
  const state = fixture(t);
  assert.equal((await act(2, "purchase")).status, 200);
  assert.equal((await act(2, "purchase")).status, 200);
  assert.equal(state.item().claimed_by, 2);
  assert.equal(state.item().purchased, 1);
  assert.equal(state.notifications.length, 1);
});

for (const actions of [["claim", "claim"], ["claim", "purchase"], ["purchase", "purchase"]]) {
  test(`simultaneous ${actions.join(" / ")} requests have just one winner`, async (t) => {
    const state = fixture(t);
    const responses = await Promise.all([act(2, actions[0]), act(3, actions[1])]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const winner = responses[0].status === 200 ? 2 : 3;
    assert.equal(state.item().claimed_by, winner);
    assert.equal(state.item().purchased, actions[winner - 2] === "purchase" ? 1 : 0);
    assert.equal(state.notifications.length, 1);
  });
}

test("duplicate simultaneous requests from one shopper succeed without duplicate notifications", async (t) => {
  const state = fixture(t);
  const responses = await Promise.all([act(2, "claim"), act(2, "claim")]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(state.notifications.length, 1);
});

for (const action of ["purchase", "unclaim"]) {
  test(`a stale ${action} cannot change a gift now claimed by someone else`, async (t) => {
    const state = fixture(t);
    await act(2, "claim");
    state.beforeWrite = () => state.sqlite.exec("UPDATE items SET claimed_by = 3 WHERE id = 1");
    assert.equal((await act(2, action)).status, 409);
    assert.equal(state.item().claimed_by, 3);
    assert.equal(state.item().purchased, 0);
  });
}

test("a gift received between reading and writing cannot be claimed", async (t) => {
  const state = fixture(t);
  state.beforeWrite = () => state.sqlite.exec("UPDATE items SET received_at = '2026-11-25' WHERE id = 1");
  assert.equal((await act(2, "claim")).status, 409);
  assert.equal(state.item().claimed_by, null);
  assert.equal(state.notifications.length, 0);
});

test("authentication, list visibility, and self-claim restrictions are enforced", async (t) => {
  const state = fixture(t);
  assert.equal((await act(null, "claim")).status, 401);
  assert.equal((await act(99, "claim")).status, 401);
  assert.equal((await act(4, "claim")).status, 404);
  assert.equal((await act(1, "claim")).status, 403);
  assert.equal(state.item().claimed_by, null);
});

test("invalid requests and missing or received gifts do not modify claims", async (t) => {
  const state = fixture(t);
  for (const rawBody of ["null", "{}", "{", '{"action":"other"}', '{"action":1}']) {
    assert.equal((await act(2, null, { rawBody })).status, 400);
  }
  assert.equal((await act(2, "claim", { id: "abc" })).status, 400);
  assert.equal((await act(2, "claim", { id: "999" })).status, 404);
  state.sqlite.exec("UPDATE items SET received_at = '2026-11-25' WHERE id = 1");
  assert.equal((await act(2, "claim")).status, 409);
  assert.equal((await act(2, "purchase")).status, 409);
  assert.equal(state.item().claimed_by, null);
  assert.equal(state.notifications.length, 0);
});

test("the public page hides received gifts and updates its count and empty state", async (t) => {
  const state = fixture(t);
  state.sqlite.exec(`
    INSERT INTO items (user_id, name, year_added, created_at, received_at)
    VALUES (1, 'Already received gift', 2026, CURRENT_TIMESTAMP, '2026-11-25');
  `);
  const render = async () => renderPage(await SharePage({
    params: Promise.resolve({ token: "public-list" }),
  }));
  const html = await render();
  assert.match(html, /Available gift/);
  assert.doesNotMatch(html, /Already received gift/);
  assert.match(html, /1 item/);
  state.sqlite.exec("UPDATE items SET received_at = '2026-11-25' WHERE id = 1");
  const empty = await render();
  assert.doesNotMatch(empty, /Available gift|Already received gift/);
  assert.match(empty, /0 items/);
  assert.match(empty, /no gifts on this list right now/);
});

function publicRequest(path, { cookie, member, body, ip = "192.0.2.10", origin = "https://wishlist.test", method = "POST" } = {}) {
  return new NextRequest(`https://wishlist.test${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": ip,
      Cookie: [cookie, member && `session_id=session-${member}`].filter(Boolean).join("; ") },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
}
function guestAction(action, { id = "1", token = "public-list", ...options } = {}) {
  return publicClaim(publicRequest(`/api/share/${token}/items/${id}`, { ...options, body: { action } }), { params: Promise.resolve({ token, id: String(id) }) });
}
function accessAction(mode, email, options = {}) {
  return publicAccess(publicRequest("/api/share/public-list/access", { ...options, body: { mode, email } }), { params: Promise.resolve({ token: "public-list" }) });
}
function responseCookie(response) {
  const value = response.headers.get("set-cookie");
  assert.ok(value, "response must set a private guest cookie");
  return value.split(";")[0];
}
async function redeem(url, options = {}) {
  const key = new URL(url).pathname.split("/").at(-1);
  return openAccess(publicRequest(`/share/access/${key}`, options), { params: Promise.resolve({ key }) });
}
function latestEmailLink(state) {
  return state.emails.at(-1).html.match(/https:\/\/theholidaywishlist\.com\/share\/access\/[a-f0-9]{64}/)[0];
}
function fixedClock(t) {
  const original = Date.now;
  let now = Math.ceil(original() / 3600000) * 3600000 + 10000;
  Date.now = () => now;
  t.after(() => { Date.now = original; });
  return (seconds) => { now += seconds * 1000; };
}

test("a guest claims without email, returns in the same browser, purchases and releases", async (t) => {
  const state = fixture(t);
  const response = await guestAction("claim");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /Secure/);
  assert.match(response.headers.get("set-cookie"), /SameSite=lax/);
  const cookie = responseCookie(response);
  assert.equal(state.emails.length, 0);
  assert.equal(state.sqlite.prepare("SELECT email FROM guest_claimants").get().email, null);
  const stored = state.sqlite.prepare("SELECT token_hash FROM guest_sessions").get().token_hash;
  assert.notEqual(stored, cookie.split("=")[1]);
  assert.equal((await guestAction("claim", { cookie })).status, 200);
  assert.equal(state.history().length, 1);
  assert.equal((await act(2, "claim")).status, 409);
  assert.equal((await act(2, "purchase")).status, 409);
  globalThis.__wishlistTestCookies.set("wishlist_guest_1", { value: cookie.split("=")[1] });
  const html = renderPage(await SharePage({ params: Promise.resolve({ token: "public-list" }) }));
  assert.match(html, /Claimed by you/);
  assert.doesNotMatch(html, new RegExp(stored));
  assert.equal((await guestAction("purchase", { cookie })).status, 200);
  assert.equal((await guestAction("unclaim", { cookie })).status, 200);
  assert.deepEqual(state.history().map((row) => row.action), ["claim", "purchase", "unclaim"]);
  assert.equal(JSON.parse(state.history()[0].before_state).guestId, null);
  assert.ok(JSON.parse(state.history()[0].after_state).guestId);
  assert.equal(state.notifications.length, 1);
});

test("another browser cannot buy or release an existing guest claim", async (t) => {
  const state = fixture(t);
  await guestAction("claim");
  assert.equal((await guestAction("purchase")).status, 403);
  assert.equal((await guestAction("unclaim")).status, 403);
  assert.equal((await guestAction("claim")).status, 409);
  assert.equal(state.history().length, 1);
});

test("a shared token grants only its own list, and the signed-in owner cannot claim", async (t) => {
  fixture(t);
  assert.equal((await guestAction("claim", { member: 1 })).status, 403);
  assert.equal((await guestAction("claim", { token: "missing" })).status, 404);
  assert.equal((await guestAction("claim", { origin: "https://evil.invalid" })).status, 403);
  const response = await guestAction("claim", { member: 4 });
  assert.equal(response.status, 200, "a legitimate shared link works for signed-in visitors outside the family too");
});

test("guest and member claims racing for the same gift cannot overwrite each other", async (t) => {
  const state = fixture(t);
  const responses = await Promise.all([guestAction("claim"), act(2, "claim")]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(state.history().length, 1);
  assert.equal(state.notifications.length, 1);
});

test("history is atomic with the claim, and deletion preserves recovery evidence", async (t) => {
  const state = fixture(t);
  state.sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON claim_history BEGIN SELECT RAISE(ABORT, 'history unavailable'); END;");
  assert.equal((await guestAction("claim")).status, 500);
  assert.equal(state.item().claimed_by, null);
  assert.equal(state.sqlite.prepare("SELECT claimed_by_guest FROM items").get().claimed_by_guest, null);
  state.sqlite.exec("DROP TRIGGER fail_history");
  assert.equal((await act(2, "claim")).status, 200);
  state.sqlite.exec("DELETE FROM items WHERE id = 1");
  assert.deepEqual(state.history().map((row) => row.action), ["claim", "delete"]);
  assert.equal(JSON.parse(state.history()[1].before_state).userId, 2);
});

test("copying a recovery link restores claims on another device without email", async (t) => {
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  const result = await accessAction("copy", undefined, { cookie });
  assert.equal(result.status, 200);
  const { url } = await result.json();
  const restored = await redeem(url);
  assert.equal(restored.status, 303);
  assert.equal((await guestAction("purchase", { cookie: responseCookie(restored) })).status, 200);
  assert.equal(state.emails.length, 0);
});

test("email recovery requires inbox access; GET previews never change session or claim state", async (t) => {
  const advance = fixedClock(t);
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  assert.equal((await accessAction("save", "friend@example.invalid", { cookie })).status, 200);
  assert.equal(state.sqlite.prepare("SELECT email FROM guest_claimants").get().email, null);
  const url = latestEmailLink(state);
  const preview = openAccessGet();
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("Referrer-Policy"), "origin", "native browser forms need their origin preserved while the private URL path stays hidden");
  assert.equal(preview.headers.get("set-cookie"), null);
  assert.equal(state.sqlite.prepare("SELECT count(*) AS n FROM guest_sessions").get().n, 1);
  assert.equal(state.history().length, 1);
  assert.doesNotMatch(await preview.text(), /googletagmanager|<script|friend@example/);
  const restored = await redeem(url);
  assert.equal(restored.status, 303);
  const restoredCookie = responseCookie(restored);
  assert.equal(state.sqlite.prepare("SELECT email FROM guest_claimants").get().email, "friend@example.invalid");
  advance(61);
  const recovery = await accessAction("recover", "friend@example.invalid", { ip: "192.0.2.20" });
  assert.equal(recovery.status, 200);
  assert.equal(state.emails.length, 2);
  assert.equal((await guestAction("purchase", { cookie: restoredCookie })).status, 200);
  assert.equal((await guestAction("unclaim", { cookie: responseCookie(await redeem(latestEmailLink(state))) })).status, 200);
});

test("typing a known email never reveals claims or grants a browser access", async (t) => {
  fixedClock(t);
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  await accessAction("save", "friend@example.invalid", { cookie });
  await redeem(latestEmailLink(state));
  const response = await accessAction("recover", "unknown@example.invalid", { ip: "192.0.2.20" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(state.emails.length, 1);
  assert.match((await response.json()).message, /If that email/);
  assert.equal((await guestAction("unclaim")).status, 403);
});

test("verified email merges the same person's claims from two browsers without exposing others", async (t) => {
  const advance = fixedClock(t);
  const state = fixture(t);
  state.addGift(2);
  const first = responseCookie(await guestAction("claim"));
  await accessAction("save", "friend@example.invalid", { cookie: first });
  await redeem(latestEmailLink(state));
  const second = responseCookie(await guestAction("claim", { id: "2", ip: "192.0.2.30" }));
  advance(61);
  await accessAction("save", "friend@example.invalid", { cookie: second, ip: "192.0.2.30" });
  const restored = responseCookie(await redeem(latestEmailLink(state)));
  assert.equal(state.sqlite.prepare("SELECT count(DISTINCT claimed_by_guest) AS n FROM items").get().n, 1);
  assert.equal((await guestAction("purchase", { id: "2", cookie: first })).status, 200, "old browser access follows the verified merge");
  assert.equal((await guestAction("unclaim", { cookie: restored })).status, 200);
  assert.equal((await guestAction("unclaim", { id: "2", cookie: second })).status, 200);
});

test("expired recovery links and cross-origin submissions grant no session", async (t) => {
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  const { url } = await (await accessAction("copy", null, { cookie })).json();
  assert.equal((await redeem(url, { origin: "https://evil.invalid" })).status, 403);
  state.sqlite.exec("UPDATE guest_access_links SET expires_at = 1");
  const expired = await redeem(url);
  assert.equal(expired.status, 410);
  assert.equal(expired.headers.get("set-cookie"), null);
});

test("email cooldowns block bursts, hourly flooding, and network-wide spam", async (t) => {
  const advance = fixedClock(t);
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  assert.equal((await accessAction("save", "friend@example.invalid", { cookie })).status, 200);
  const burst = await accessAction("save", "friend@example.invalid", { cookie });
  assert.equal(burst.status, 429);
  assert.ok(Number(burst.headers.get("Retry-After")) > 0);
  advance(61);
  assert.equal((await accessAction("save", "friend@example.invalid", { cookie })).status, 200);
  advance(61);
  assert.equal((await accessAction("save", "friend@example.invalid", { cookie })).status, 200);
  advance(61);
  assert.equal((await accessAction("save", "friend@example.invalid", { cookie })).status, 429);
  assert.equal(state.emails.length, 3);
  for (let n = 0; n < 10; n++) await accessAction("recover", `test${n}@example.invalid`, { ip: "192.0.2.100" });
  assert.equal((await accessAction("recover", "extra@example.invalid", { ip: "192.0.2.100" })).status, 429);
});

test("claim limits cannot be bypassed by releasing gifts or clearing browser cookies", async (t) => {
  fixedClock(t);
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  for (let id = 2; id <= 13; id++) state.addGift(id);
  for (let id = 2; id <= 12; id++) assert.equal((await guestAction("claim", { id: String(id), cookie })).status, 200);
  assert.equal((await guestAction("claim", { id: "13", cookie })).status, 429);
  assert.equal((await guestAction("unclaim", { cookie })).status, 200, "a claim cap must still let friends release gifts");
  for (let n = 0; n < 20; n++) await guestAction("claim", { id: "13", ip: "192.0.2.200" });
  assert.equal((await guestAction("claim", { id: "13", ip: "192.0.2.200" })).status, 429);
  assert.equal(state.sqlite.prepare("SELECT count(*) AS n FROM claim_history WHERE item_id = 13").get().n, 1);
});

test("rate counters enforce one winner across simultaneous Worker requests", async (t) => {
  const state = fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => limit(state.binding, "same-limit", 3, 3600)));
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 3);
});

test("replacing or disabling a shared link preserves claims while revoking the old URL", async (t) => {
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  const request = (body = {}) => publicRequest("/api/users/me/share-link", { member: 1, body });
  assert.equal((await (await shareControl(request())).json()).token, "public-list");
  const changed = await (await shareControl(request({ action: "replace" }))).json();
  assert.notEqual(changed.token, "public-list");
  assert.equal((await guestAction("purchase", { cookie })).status, 404);
  assert.equal((await guestAction("purchase", { cookie, token: changed.token })).status, 200);
  assert.equal((await disableSharing(request())).status, 200);
  assert.equal((await guestAction("unclaim", { cookie, token: changed.token })).status, 404);
  assert.ok(state.sqlite.prepare("SELECT claimed_by_guest FROM items").get().claimed_by_guest);
  assert.equal(state.item().purchased, 1);
});

test("email cooldown remains sixty seconds across a calendar-minute boundary", async (t) => {
  const advance = fixedClock(t);
  const state = fixture(t);
  advance(49);
  await limit(state.binding, "minute-boundary", 1, 60);
  advance(2);
  await assert.rejects(limit(state.binding, "minute-boundary", 1, 60), { status: 429 });
  advance(58);
  await limit(state.binding, "minute-boundary", 1, 60);
});

test("pending links for another address cannot move claims after email confirmation", async (t) => {
  fixedClock(t);
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  await accessAction("save", "first@example.invalid", { cookie });
  const first = latestEmailLink(state);
  await accessAction("save", "second@example.invalid", { cookie });
  const second = latestEmailLink(state);
  assert.equal((await redeem(first)).status, 303);
  const invalid = await redeem(second);
  assert.equal(invalid.status, 410);
  assert.equal(invalid.headers.get("set-cookie"), null);
  assert.equal(state.sqlite.prepare("SELECT email FROM guest_claimants").get().email, "first@example.invalid");
});

test("signed-in owners get no claim status or guest identity in public-page props", async (t) => {
  const state = fixture(t);
  await guestAction("claim");
  const guestId = state.sqlite.prepare("SELECT claimed_by_guest FROM items").get().claimed_by_guest;
  globalThis.__wishlistTestCookies.set("session_id", { value: "session-1" });
  const page = await SharePage({ params: Promise.resolve({ token: "public-list" }) });
  const html = renderPage(page);
  assert.doesNotMatch(html, /Already claimed|Claimed by you|Already purchased|Claim this gift/);
  assert.doesNotMatch(JSON.stringify(page), new RegExp(guestId));
  assert.match(html, /This is your list/);
});

test("turning off sharing stops a guest claim already in flight before its write", async (t) => {
  const state = fixture(t);
  state.beforeWrite = () => state.sqlite.exec("UPDATE users SET share_token = NULL WHERE id = 1");
  assert.equal((await guestAction("claim")).status, 409);
  assert.equal(state.sqlite.prepare("SELECT claimed_by_guest FROM items").get().claimed_by_guest, null);
  assert.equal(state.history().length, 0);
});

test("recovery email confirmation is returned only after the email worker accepts it", async (t) => {
  fixedClock(t);
  const state = fixture(t);
  const cookie = responseCookie(await guestAction("claim"));
  globalThis.__wishlistTestContext.env.EMAIL_WORKER.fetch = async () => Response.json({ error: "test delivery failure" }, { status: 500 });
  const response = await accessAction("save", "friend@example.invalid", { cookie });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Couldn't send the email/);
  assert.equal(state.sqlite.prepare("SELECT count(*) AS n FROM guest_access_links").get().n, 0);
  assert.equal(state.history().length, 1);
  assert.ok(state.sqlite.prepare("SELECT claimed_by_guest FROM items").get().claimed_by_guest);
});
