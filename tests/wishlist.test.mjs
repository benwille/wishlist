import assert from "node:assert/strict";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
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
    },
  }],
});

const require = createRequire(import.meta.url);
const { POST } = require(join(output, "claim.cjs"));
const { default: SharePage } = require(join(output, "share.cjs"));
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

  const state = { sqlite, notifications: [], beforeWrite: null };
  // D1's prepared-statement interface backed by real SQLite. This exercises
  // the production SQL, including conditional UPDATE ... RETURNING statements.
  function prepare(sql, parameters = []) {
    return {
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
    };
  }
  globalThis.__wishlistTestContext = {
    env: {
      DB: { prepare },
      PUSH_WORKER: {
        async fetch(_url, options) {
          state.notifications.push(JSON.parse(options.body));
          return Response.json({ sent: 1, failed: 0, gone: [] });
        },
      },
    },
  };
  state.item = () => sqlite.prepare("SELECT claimed_by, purchased, received_at FROM items WHERE id = 1").get();
  return state;
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
  const render = async () => renderToStaticMarkup(await SharePage({
    params: Promise.resolve({ token: "public-list" }),
  }));
  const html = await render();
  assert.match(html, /Available gift/);
  assert.doesNotMatch(html, /Already received gift/);
  assert.match(html, /1 items/);
  state.sqlite.exec("UPDATE items SET received_at = '2026-11-25' WHERE id = 1");
  const empty = await render();
  assert.doesNotMatch(empty, /Available gift|Already received gift/);
  assert.match(empty, /0 items/);
  assert.match(empty, /hasn&#x27;t added anything yet/);
});
