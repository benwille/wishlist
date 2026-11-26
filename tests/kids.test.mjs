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
    peopleApi: "src/app/api/people/route.ts",
    groupPeopleApi: "src/app/api/exchange/groups/[id]/people/route.ts",
    profilesPage: "src/app/people/page.tsx",
    adminPeoplePage: "src/app/admin/people/page.tsx",
    groupAdminPage: "src/app/admin/groups/[id]/page.tsx",
    authSession: "src/lib/auth/session.ts",
    accountApi: "src/app/api/users/[id]/route.ts",
    adultDraw: "src/app/api/exchange/groups/[id]/run/route.ts",
    kidsRules: "src/lib/exchange/kids-algorithm.ts",
    kidsQueries: "src/lib/exchange/kids.ts",
    groupPage: "src/app/exchange/[groupId]/page.tsx",
    personalExchangePage: "src/app/exchange/page.tsx",
    drawComponent: "src/components/ExchangeDraw.tsx",
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
 const drawAdults = assignments => adultDraw(new NextRequest("https://wishlist.test/api/exchange/groups/1/run", {method:"POST",headers:{"Content-Type":"application/json",Cookie:"session_id=session-1"},body:JSON.stringify({year:2026,preview:false,assignments,replace:true})}), {params:Promise.resolve({id:"1"})});
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


test("group assignment years include child-only years and separate adults/kids within each year", async t => {
 const {sqlite}=adminFixture(t);
 sqlite.exec(`
  INSERT INTO children(id,first_name,last_name) VALUES (11,'EarlierKid','Test'),(12,'LaterKid','Test');
  INSERT INTO child_assignments(group_id,giver_id,receiver_id,year) VALUES (1,11,12,2025),(1,12,11,2027);
  INSERT INTO exchange_assignments(group_id,giver_id,receiver_id,year,created_at) VALUES (1,1,2,2026,CURRENT_TIMESTAMP);
 `);
 globalThis.__wishlistTestCookies=new Map([["session_id",{value:"session-2"}]]);
 const html=renderPage(await GroupPage({params:Promise.resolve({groupId:"1"})}));
 assert.ok(html.indexOf('id="assignments-2027"')<html.indexOf('id="assignments-2026"'));
 assert.ok(html.indexOf('id="assignments-2026"')<html.indexOf('id="assignments-2025"'));
 for(const year of [2025,2026,2027]) {
  const start=html.indexOf(`id="assignments-${year}"`),end=html.indexOf('<section aria-labelledby="assignments-',start);
  const section=html.slice(start,end===-1?undefined:end);
  assert.match(section,new RegExp(`id="adults-${year}"`));assert.match(section,new RegExp(`id="kids-${year}"`));
  if(year===2026){assert.match(section,/Owner Test/);assert.doesNotMatch(section,/EarlierKid|LaterKid/);}
  else {assert.match(section,/EarlierKid Test|LaterKid Test/);assert.doesNotMatch(section,/Owner Test/);}
 }
});


const peopleApi=require(join(output,"peopleApi.cjs"));
const {POST:groupPeopleApi}=require(join(output,"groupPeopleApi.cjs"));
function peopleRequest(body,userId=1,method="POST") {
 const request=new NextRequest("https://wishlist.test/api/people",{method,headers:{"Content-Type":"application/json",...(userId?{Cookie:`session_id=session-${userId}`}:{})},...(method==="GET"?{}:{body:JSON.stringify(body)})});return peopleApi[method](request);
}
function groupPerson(body,userId=1,id="1") {return groupPeopleApi(new NextRequest(`https://wishlist.test/api/exchange/groups/${id}/people`,{method:"POST",headers:{"Content-Type":"application/json",...(userId?{Cookie:`session_id=session-${userId}`}:{})},body:JSON.stringify(body)}),{params:Promise.resolve({id})});}
test("populated migration preserves colliding adult/child identities, links, claims and draws",t=>{
 const sqlite=new DatabaseSync(":memory:");t.after(()=>sqlite.close());for(const migration of migrations.slice(0,-1))sqlite.exec(migration);
 sqlite.exec(`
 INSERT INTO users(id,first_name,last_name,email,password_hash,created_at,updated_at) VALUES (1,'Existing','Adult','adult@example.invalid','saved-hash',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),(7,'Other','Adult',NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
 INSERT INTO children(id,first_name,last_name) VALUES(1,'Existing','Child'),(7,'Other','Child');
 INSERT INTO exchange_groups(id,name,created_at) VALUES(1,'Family',CURRENT_TIMESTAMP),(2,'Friends',CURRENT_TIMESTAMP);
 INSERT INTO exchange_group_members(group_id,user_id) VALUES(1,1),(1,7);
 INSERT INTO child_group_members(group_id,child_id) VALUES(1,1),(2,1),(1,7);
 INSERT INTO child_adults(child_id,adult_id) VALUES(1,1),(1,7),(7,7);
 INSERT INTO exchange_assignments(group_id,giver_id,receiver_id,year,created_at) VALUES(1,1,7,2026,CURRENT_TIMESTAMP),(1,7,1,2026,CURRENT_TIMESTAMP);
 INSERT INTO child_assignments(group_id,giver_id,receiver_id,year) VALUES(1,1,7,2026),(1,7,1,2026);
 INSERT INTO exchange_exclusions(group_id,user_id_1,user_id_2) VALUES(2,1,7);
 INSERT INTO child_exclusions(group_id,child_id_1,child_id_2) VALUES(2,1,7);
 INSERT INTO items(id,user_id,name,claimed_by,purchased,year_added,created_at) VALUES(1,1,'Existing claim',7,1,2026,CURRENT_TIMESTAMP);
 `);
 const adultDraws=sqlite.prepare("SELECT * FROM exchange_assignments").all(),childDraws=sqlite.prepare("SELECT * FROM child_assignments").all(),history=sqlite.prepare("SELECT * FROM claim_history").all();
 sqlite.exec(migrations.at(-1));
 assert.deepEqual(sqlite.prepare("SELECT * FROM exchange_assignments").all(),adultDraws);assert.deepEqual(sqlite.prepare("SELECT * FROM child_assignments").all(),childDraws);assert.deepEqual(sqlite.prepare("SELECT * FROM claim_history").all(),history);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM people").get().n,4);assert.equal(sqlite.prepare("SELECT person_id FROM children WHERE id=1").get().person_id,8);assert.equal(sqlite.prepare("SELECT person_id FROM children WHERE id=7").get().person_id,14);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM person_guardians").get().n,3);assert.equal(sqlite.prepare("SELECT count(*) n FROM group_people").get().n,5);assert.equal(sqlite.prepare("SELECT count(*) n FROM group_people WHERE person_id=8").get().n,2);
 assert.equal(sqlite.prepare("SELECT password_hash FROM users WHERE id=1").get().password_hash,'saved-hash');const gift=sqlite.prepare("SELECT * FROM items WHERE id=1").get();assert.equal(gift.person_id,1);assert.equal(gift.claimed_by,7);assert.equal(gift.purchased,1);assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length,0);
});
test("one Child person is created without account or group and is reused across exchanges",async t=>{
 const {sqlite}=adminFixture(t);
 const created=await peopleRequest({action:"create",profileType:"child",firstName:"Reusable",lastName:"Child",guardianIds:[1,2,3,4]});assert.equal(created.status,201,JSON.stringify(await created.clone().json()));const {id}=await created.json();
 assert.equal(sqlite.prepare("SELECT count(*) n FROM users").get().n,4);assert.equal(sqlite.prepare("SELECT count(*) n FROM child_group_members").get().n,0);assert.equal(sqlite.prepare("SELECT count(*) n FROM person_guardians WHERE person_id=?").get(id).n,4);
 sqlite.exec("INSERT INTO exchange_groups(id,name,created_at) VALUES(2,'Friends',CURRENT_TIMESTAMP)");
 for(const group of ["1","2"])assert.equal((await groupPerson({action:"add",personId:id},1,group)).status,200);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM people WHERE profile_type='child'").get().n,1);assert.equal(sqlite.prepare("SELECT count(*) n FROM group_people WHERE person_id=?").get(id).n,2);
 assert.equal((await peopleRequest({action:"edit",id,firstName:"Renamed",lastName:"Child",profileType:"child",guardianIds:[1,4]})).status,200);assert.equal(sqlite.prepare("SELECT first_name FROM children WHERE person_id=?").get(id).first_name,'Renamed');assert.equal(sqlite.prepare("SELECT count(*) n FROM child_adults").get().n,2);
 const adult=await peopleRequest({action:"create",profileType:"adult",firstName:"New",lastName:"Adult"});assert.equal(adult.status,201);const adultId=(await adult.json()).id;assert.notEqual(adultId,5);assert.equal(sqlite.prepare("SELECT account_id FROM people WHERE id=?").get(adultId).account_id,5);
 sqlite.exec("INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES('session-5',5,'2999-01-01',CURRENT_TIMESTAMP)");
 const freshActor=await(await peopleRequest(null,5,"GET")).json();assert.deepEqual(freshActor.people.map(p=>p.id),[adultId]);assert.ok(!freshActor.people.some(p=>p.id===id));
});
test("ordinary parents cannot enumerate adults, attach guardians or edit a co-member child",async t=>{
 const {sqlite}=adminFixture(t);const id=(await (await peopleRequest({action:"create",profileType:"child",firstName:"Managed",lastName:"Child",guardianIds:[4]})).json()).id;
 assert.equal((await peopleRequest({action:"create",profileType:"child",firstName:"No",lastName:"Permission",guardianIds:[2]},2)).status,403);
 const parent=await (await peopleRequest(null,4,"GET")).json();assert.deepEqual(parent.adults,[]);assert.deepEqual(parent.people.map(p=>p.firstName).sort(),['Managed','Outsider']);assert.ok(parent.people.every(p=>p.guardianIds===undefined&&p.accountId===undefined));
 assert.equal((await groupPerson({action:"add",personId:id})).status,200);
 const peer=await (await peopleRequest(null,2,"GET")).json();assert.ok(!peer.people.some(p=>p.id===id));
 assert.equal((await peopleRequest({action:"edit",id,firstName:"Intruder",lastName:"Child"},2)).status,403);
 assert.equal((await peopleRequest({action:"edit",id,firstName:"ParentEdit",lastName:"Child"},4)).status,200);
 assert.equal((await peopleRequest({action:"edit",id,firstName:"Hijack",lastName:"Child",guardianIds:[2]},4)).status,403);
 assert.equal(sqlite.prepare("SELECT first_name FROM people WHERE id=?").get(id).first_name,'ParentEdit');
 assert.equal((await peopleRequest({action:"edit",id,profileType:"child",firstName:"ParentEdit",lastName:"Child",guardianIds:[1]})).status,200);
 assert.equal((await peopleRequest({action:"edit",id,firstName:"Revoked",lastName:"Child"},4)).status,403);
 assert.equal((await peopleRequest(null,null,"GET")).status,401);
});
test("exchange settings are server enforced and exclusions stay within the selected group/type",async t=>{
 const {sqlite}=adminFixture(t);sqlite.exec("INSERT INTO exchange_groups(id,name,created_at) VALUES(2,'Friends',CURRENT_TIMESTAMP)");
 const ids=[];for(const firstName of ['One','Two'])ids.push((await (await peopleRequest({action:"create",profileType:"child",firstName,lastName:"Child",guardianIds:[1]})).json()).id);
 for(const id of ids)assert.equal((await groupPerson({action:"add",personId:id})).status,200);
 assert.equal((await groupPerson({action:"exclude",personId1:ids[0],personId2:ids[1]})).status,200);
 assert.equal((await groupPerson({action:"exclude",personId1:ids[0],personId2:ids[1]},1,"2")).status,400);
 assert.equal((await groupPerson({action:"exclude",personId1:1,personId2:ids[0]})).status,400);
 assert.equal((await groupPerson({action:"settings",profileType:"child",enabled:true},2)).status,403);
 assert.equal((await kidAct({action:"preview",year:2026})).status,409);
 assert.equal((await groupPerson({action:"settings",profileType:"child",enabled:true})).status,200);
 assert.equal((await groupPerson({action:"include",personId1:ids[0],personId2:ids[1]})).status,200);
 assert.equal((await kidAct({action:"preview",year:2026})).status,200);
 assert.equal((await groupPerson({action:"settings",profileType:"child",enabled:false})).status,200);
 assert.equal((await kidAct({action:"save",year:2026,assignments:[]})).status,409);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM child_group_members").get().n,2);
});


test("inactive migrated guardian links survive a profile edit without allowing new inactive guardians",async t=>{
 const {sqlite}=adminFixture(t);const id=(await(await peopleRequest({action:"create",profileType:"child",firstName:"Existing",lastName:"Child",guardianIds:[1,4]})).json()).id;
 sqlite.exec("UPDATE users SET active=0 WHERE id IN(3,4)");
 assert.equal((await peopleRequest({action:"edit",id,firstName:"StillLinked",lastName:"Child",guardianIds:[1,4]})).status,200);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM person_guardians WHERE person_id=?").get(id).n,2);
 assert.equal((await peopleRequest({action:"edit",id,firstName:"NoNewLink",lastName:"Child",guardianIds:[1,3,4]})).status,400);
 assert.equal(sqlite.prepare("SELECT first_name FROM people WHERE id=?").get(id).first_name,'StillLinked');
});
test("child profiles have no login and existing type changes require a dedicated future conversion",async t=>{
 const {sqlite,binding}=adminFixture(t);
 const {validateSession}=require(join(output,"authSession.cjs"));
 const id=(await(await peopleRequest({action:"create",profileType:"child",firstName:"Keep",lastName:"Identity",guardianIds:[1]})).json()).id;
 assert.equal((await peopleRequest({action:"edit",id,profileType:"adult",firstName:"Keep",lastName:"Identity"})).status,400);
 assert.equal(sqlite.prepare("SELECT profile_type FROM people WHERE id=?").get(id).profile_type,'child');
 assert.equal(sqlite.prepare("SELECT account_id FROM people WHERE id=?").get(id).account_id,null);
 sqlite.exec("UPDATE people SET profile_type='child' WHERE account_id=4");assert.equal(await validateSession((await import('drizzle-orm/d1')).drizzle(binding), 'session-4'),null);
});
test("linked adult accounts cannot be deleted and disabled adult draws reject direct requests",async t=>{
 const {sqlite}=adminFixture(t);await peopleRequest({action:"create",profileType:"child",firstName:"Protected",lastName:"Child",guardianIds:[4]});
 assert.throws(()=>sqlite.prepare("DELETE FROM users WHERE id=4").run(),/linked children/);
 const {DELETE:deleteAccount}=require(join(output,"accountApi.cjs"));
 const response=await deleteAccount(new NextRequest('https://wishlist.test/api/users/4',{method:'DELETE',headers:{Cookie:'session_id=session-1'}}),{params:Promise.resolve({id:'4'})});assert.equal(response.status,409);assert.ok(sqlite.prepare("SELECT id FROM users WHERE id=4").get());
 await groupPerson({action:"settings",profileType:"adult",enabled:false});
 const {POST:adultRun}=require(join(output,"adultDraw.cjs"));
 assert.equal((await adultRun(new NextRequest('https://wishlist.test/api/exchange/groups/1/run',{method:'POST',headers:{Cookie:'session_id=session-1','Content-Type':'application/json'},body:JSON.stringify({year:2026,preview:true})}),{params:Promise.resolve({id:'1'})})).status,409);
});


test("Gift Exchange combines only your and linked kids' assignments under each year, even for admins",async t=>{
 const {sqlite}=adminFixture(t);const {default:PersonalExchange}=require(join(output,"personalExchangePage.cjs"));
 sqlite.exec(`
 INSERT INTO exchange_groups(id,name,created_at) VALUES(2,'Historical Friends',CURRENT_TIMESTAMP);
 INSERT INTO children(id,first_name,last_name) VALUES(11,'OwnChild','Test'),(12,'PeerTarget','Test'),(13,'OtherKid','Test'),(14,'OtherReceiver','Test');
 INSERT INTO child_adults(child_id,adult_id) VALUES(11,1),(11,2),(13,3);
 INSERT INTO child_assignments(group_id,giver_id,receiver_id,year) VALUES(1,11,12,2026),(2,11,14,2025),(1,13,14,2099);
 INSERT INTO exchange_assignments(group_id,giver_id,receiver_id,year,created_at) VALUES(1,1,2,2024,CURRENT_TIMESTAMP),(1,2,1,2023,CURRENT_TIMESTAMP),(1,3,4,2098,CURRENT_TIMESTAMP);
 `);
 for(const actor of [1,2]){
  globalThis.__wishlistTestCookies=new Map([["session_id",{value:`session-${actor}`}]]);
  const html=renderPage(await PersonalExchange());
  assert.match(html,/id="personal-year-2026"/);assert.match(html,/id="personal-year-2025"/);
  assert.doesNotMatch(html,/personal-year-2099|personal-year-2098/);
  assert.match(html,/OwnChild Test/);assert.doesNotMatch(html,/OtherKid Test/);
  assert.ok(html.indexOf('id="personal-year-2026"')<html.indexOf('id="personal-year-2025"'));
  const start=html.indexOf('id="personal-year-2026"'),end=html.indexOf('id="personal-year-2025"');const section=html.slice(start,end);
  assert.match(section,/your-assignment-2026/);assert.match(section,/your-kids-2026/);assert.match(section,/PeerTarget Test/);assert.doesNotMatch(section,/Historical Friends|OtherReceiver Test/);
  assert.match(html,/Historical Friends/);assert.match(html,/View all assignments/);
  const all=renderPage(await GroupPage({params:Promise.resolve({groupId:"1"})}));assert.match(all,/OtherKid Test/);assert.match(all,/assignments-2099/);
 }
 globalThis.__wishlistTestCookies=new Map([["session_id",{value:"session-4"}]]);
 const empty=renderPage(await PersonalExchange());assert.match(empty,/No assignments for you or your linked kids yet/);assert.doesNotMatch(empty,/OwnChild Test|OtherKid Test/);
});


test("saved draws show explicit status and Redraw instead of the normal preview action",()=>{
 const {default:Draw}=require(join(output,"drawComponent.cjs"));const year=new Date().getFullYear();
 const saved=renderPage(createElement(Draw,{groupId:1,kind:"adult",enabled:true,memberCount:3,savedYears:[year]}));
 assert.match(saved,/Assignments saved for/);assert.match(saved,/View assignments/);assert.match(saved,/Redraw adult draw/);assert.doesNotMatch(saved,/Preview adult draw/);
 const fresh=renderPage(createElement(Draw,{groupId:1,kind:"adult",enabled:true,memberCount:3,savedYears:[]}));assert.match(fresh,/Preview adult draw/);assert.doesNotMatch(fresh,/Assignments saved for/);
 const disabled=renderPage(createElement(Draw,{groupId:1,kind:"child",enabled:false,memberCount:0,savedYears:[year]}));assert.match(disabled,/Assignments saved for/);assert.match(disabled,/View assignments/);assert.doesNotMatch(disabled,/Redraw kids/);
});
