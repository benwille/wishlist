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
    kids: "src/app/api/exchange/groups/[id]/kids/route.ts",
    adultDraw: "src/app/api/exchange/groups/[id]/run/route.ts",
    kidsRules: "src/lib/exchange/kids-algorithm.ts",
    kidsQueries: "src/lib/exchange/kids.ts",
    groupPage: "src/app/exchange/[groupId]/page.tsx",
    dashboard: "src/app/page.tsx",
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
  plugins: [
    {
      name: "test-cloudflare-context",
      setup(builder) {
        builder.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({
          path: "cloudflare-context",
          namespace: "test",
        }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            "export function getCloudflareContext() { return globalThis.__wishlistTestContext; }",
        }));
        builder.onResolve({ filter: /^next\/headers$/ }, () => ({
          path: "headers",
          namespace: "test-headers",
        }));
        builder.onLoad({ filter: /.*/, namespace: "test-headers" }, () => ({
          contents:
            "export async function cookies() { return globalThis.__wishlistTestCookies; }",
        }));
      },
    },
  ],
});

const require = createRequire(import.meta.url);
const { POST } = require(join(output, "claim.cjs"));
const { default: SharePage } = require(join(output, "share.cjs"));
const { POST: publicClaim } = require(join(output, "publicClaim.cjs"));
const { POST: publicAccess } = require(join(output, "publicAccess.cjs"));
const { GET: openAccessGet, POST: openAccess } = require(
  join(output, "openAccess.cjs"),
);
const { POST: shareControl, DELETE: disableSharing } = require(
  join(output, "shareControl.cjs"),
);
const { hash, limit } = require(join(output, "shareTools.cjs"));
const {
  PathnameContext,
} = require("next/dist/shared/lib/hooks-client-context.shared-runtime.js");
const {
  AppRouterContext,
} = require("next/dist/shared/lib/app-router-context.shared-runtime.js");
const migrations = await Promise.all(
  (await readdir(join(root, "drizzle/migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort()
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
      sql,
      parameters,
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
      async first() {
        return sqlite.prepare(sql).get(...parameters) ?? null;
      },
    };
  }
  const binding = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map(({ sql, parameters }) => {
          const statement = sqlite.prepare(sql);
          const rows = statement.columns().length
            ? statement.all(...parameters)
            : [];
          if (!statement.columns().length) statement.run(...parameters);
          return { success: true, results: rows, meta: {} };
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  globalThis.__wishlistTestCookies = new Map();
  globalThis.__wishlistTestContext = {
    env: {
      DB: binding,
      EMAIL_WORKER: {
        async fetch(_url, options) {
          state.emails.push(JSON.parse(options.body));
          return Response.json({ ok: true });
        },
      },
      PUSH_WORKER: {
        async fetch(_url, options) {
          state.notifications.push(JSON.parse(options.body));
          return Response.json({ sent: 1, failed: 0, gone: [] });
        },
      },
    },
  };
  state.item = () =>
    sqlite
      .prepare(
        "SELECT claimed_by, purchased, received_at FROM items WHERE id = 1",
      )
      .get();
  state.binding = binding;
  state.history = () =>
    sqlite.prepare("SELECT * FROM claim_history ORDER BY id").all();
  state.addGift = (id) =>
    sqlite
      .prepare(
        "INSERT INTO items (id,user_id,name,year_added,created_at) VALUES (?,1,?,2026,CURRENT_TIMESTAMP)",
      )
      .run(id, `Gift ${id}`);
  return state;
}

function renderPage(element) {
  return renderToStaticMarkup(
    createElement(
      PathnameContext.Provider,
      { value: "/" },
      createElement(
        AppRouterContext.Provider,
        { value: { refresh() {} } },
        element,
      ),
    ),
  );
}

function act(userId, action, { id = "1", rawBody } = {}) {
  return POST(
    new NextRequest(`https://wishlist.test/api/items/${id}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { Cookie: `session_id=session-${userId}` } : {}),
      },
      body: rawBody ?? JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const { POST: kids } = require(join(output, "kids.cjs"));
const { generateKids, validateKids } = require(join(output, "kidsRules.cjs"));
const { accessibleGroups, kidsAssignments, linkedKids } = require(
  join(output, "kidsQueries.cjs"),
);
const { default: GroupPage } = require(join(output, "groupPage.cjs"));
const { default: Dashboard } = require(join(output, "dashboard.cjs"));
async function kidAct(body, userId = 1, id = "1") {
  return kids(
    new NextRequest(`https://wishlist.test/api/exchange/groups/${id}/kids`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { Cookie: `session_id=session-${userId}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}
function adminFixture(t) {
  const state = fixture(t);
  state.sqlite.exec("UPDATE users SET is_admin=1 WHERE id=1");
  return state;
}
async function addChild(adultIds = [1, 2, 3, 4], firstName = "Kid") {
  const response = await kidAct({
    action: "create",
    firstName,
    lastName: "Test",
    adultIds,
  });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
}
test("kids mutations require an administrator and a real group", async (t) => {
  adminFixture(t);
  assert.equal((await kidAct({ action: "create" }, null)).status, 401);
  assert.equal((await kidAct({ action: "create" }, 2)).status, 403);
  assert.equal((await kidAct({ action: "create" }, 1, "999")).status, 404);
  assert.equal((await kidAct(null)).status, 400);
});
test("create and edit children with four adult links atomically; no login or wishlist", async (t) => {
  const { sqlite } = adminFixture(t);
  await addChild();
  await addChild([2, 3], "Second");
  assert.equal(sqlite.prepare("SELECT count(*) n FROM children").get().n, 2);
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM child_adults WHERE child_id=1").get()
      .n,
    4,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM child_adults WHERE child_id=2").get()
      .n,
    2,
  );
  assert.equal(sqlite.prepare("SELECT count(*) n FROM users").get().n, 4);
  assert.equal(
    (
      await kidAct({
        action: "edit",
        childId: 1,
        firstName: "Renamed",
        lastName: "Test",
        adultIds: [2, 4],
      })
    ).status,
    200,
  );
  assert.deepEqual(
    sqlite
      .prepare(
        "SELECT adult_id FROM child_adults WHERE child_id=1 ORDER BY adult_id",
      )
      .all()
      .map((r) => r.adult_id),
    [2, 4],
  );
  assert.equal(
    (
      await kidAct({
        action: "create",
        firstName: "Invalid",
        lastName: "Test",
        adultIds: [999],
      })
    ).status,
    400,
  );
  assert.equal(sqlite.prepare("SELECT count(*) n FROM children").get().n, 2);
});
test("six kids with three sibling exclusions can draw and save; invalid saves preserve history", async (t) => {
  const { sqlite } = adminFixture(t);
  for (let i = 1; i <= 6; i++) await addChild([1, 2], `Child${i}`);
  for (const [childId1, childId2] of [
    [1, 2],
    [3, 4],
    [5, 6],
  ])
    assert.equal(
      (await kidAct({ action: "exclude", childId1, childId2 })).status,
      200,
    );
  const preview = await kidAct({ action: "preview", year: 2026 });
  assert.equal(preview.status, 200);
  const { assignments } = await preview.json();
  assert.equal(
    (await kidAct({ action: "save", year: 2026, assignments })).status,
    200,
  );
  assert.equal(
    (await kidAct({ action: "save", year: 2026, assignments })).status,
    409,
  );
  assert.equal(
    (await kidAct({ action: "save", year: 2026, assignments, replace: true }))
      .status,
    200,
  );
  assert.equal(
    (
      await kidAct({
        action: "save",
        year: 2026,
        assignments: assignments.map((a) => ({ ...a, receiverId: a.giverId })),
        replace: true,
      })
    ).status,
    400,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM child_assignments").get().n,
    6,
  );
  const next = await (await kidAct({ action: "preview", year: 2027 })).json();
  assert.equal(next.assignments.length, 6);
  assert.ok(
    next.assignments.every(
      (a) =>
        !assignments.some(
          (p) => p.giverId === a.giverId && p.receiverId === a.receiverId,
        ),
    ),
  );
  assert.equal((await kidAct({ action: "remove", childId: 1 })).status, 200);
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM child_assignments").get().n,
    6,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM child_exclusions").get().n,
    2,
  );
  assert.equal((await kidAct({ action: "add", childId: 1 })).status, 200);
});
test("matching rejects impossible draws, permits reciprocal pairs, and ignores two-year-old history", () => {
  const members = [1, 2, 3, 4];
  const exclusions = [
    { childId1: 1, childId2: 2 },
    { childId1: 1, childId2: 3 },
    { childId1: 2, childId2: 3 },
  ];
  assert.throws(() => generateKids(members, exclusions, [], 2026), /No valid/);
  assert.deepEqual(
    generateKids(
      [1, 2],
      [],
      [{ giverId: 1, receiverId: 2, year: 2024 }],
      2026,
    ).sort((a, b) => a.giverId - b.giverId),
    [
      { giverId: 1, receiverId: 2 },
      { giverId: 2, receiverId: 1 },
    ],
  );
  assert.throws(
    () =>
      generateKids(
        [1, 2],
        [],
        [{ giverId: 1, receiverId: 2, year: 2025 }],
        2026,
      ),
    /No valid/,
  );
  assert.throws(() =>
    validateKids(
      [
        { giverId: 1, receiverId: 2 },
        { giverId: 2, receiverId: 2 },
      ],
      [1, 2],
      [],
      [],
      2026,
    ),
  );
});
test("linked adult sees own kids on home and the family draw; unrelated adult cannot open the group", async (t) => {
  const state = adminFixture(t);
  await addChild([4], "MyChild");
  await addChild([1], "Recipient");
  const { assignments } = await (
    await kidAct({ action: "preview", year: new Date().getFullYear() })
  ).json();
  await kidAct({ action: "save", year: new Date().getFullYear(), assignments });
  globalThis.__wishlistTestCookies = new Map([
    ["session_id", { value: "session-4" }],
  ]);
  const home = renderPage(await Dashboard());
  assert.match(home, /MyChild Test/);
  assert.match(home, /Your kids/);
  assert.doesNotMatch(home, /View list.*Recipient/);
  const group = renderPage(
    await GroupPage({ params: Promise.resolve({ groupId: "1" }) }),
  );
  assert.match(group, /Adults/);
  assert.match(group, /Kids/);
  assert.match(group, /Recipient Test/);
  state.sqlite.exec("DELETE FROM child_adults WHERE adult_id=4");
  await assert.rejects(() =>
    GroupPage({ params: Promise.resolve({ groupId: "1" }) }),
  );
});


test("adult and kids draws cannot overwrite each other, including replacements", async t => {
 const {sqlite} = adminFixture(t);
 const {POST: adultDraw} = require(join(output, "adultDraw.cjs"));
 const adults = [{giverId:1,receiverId:2},{giverId:2,receiverId:3},{giverId:3,receiverId:1}];
 const drawAdults = assignments => adultDraw(new NextRequest("https://wishlist.test/api/exchange/groups/1/run", {method:"POST",headers:{"Content-Type":"application/json",Cookie:"session_id=session-1"},body:JSON.stringify({year:2026,preview:false,assignments})}), {params:Promise.resolve({id:"1"})});
 assert.equal((await drawAdults(adults)).status,200);
 const adultBefore = sqlite.prepare("SELECT * FROM exchange_assignments ORDER BY giver_id").all();
 await addChild([1],"First"); await addChild([2],"Second");
 const {assignments} = await (await kidAct({action:"preview",year:2026})).json();
 assert.equal((await kidAct({action:"save",year:2026,assignments})).status,200);
 assert.equal((await kidAct({action:"save",year:2026,assignments,replace:true})).status,200);
 assert.deepEqual(sqlite.prepare("SELECT * FROM exchange_assignments ORDER BY giver_id").all(),adultBefore);
 const kidsBefore = sqlite.prepare("SELECT * FROM child_assignments ORDER BY giver_id").all();
 assert.equal((await drawAdults([{giverId:1,receiverId:3},{giverId:3,receiverId:2},{giverId:2,receiverId:1}])).status,200);
 assert.deepEqual(sqlite.prepare("SELECT * FROM child_assignments ORDER BY giver_id").all(),kidsBefore);
});
