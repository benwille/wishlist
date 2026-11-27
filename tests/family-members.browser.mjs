// Local-only UI regression using disposable synthetic accounts.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright-core"
);
const origin = process.env.KIDS_PREVIEW_ORIGIN || "http://localhost:8788";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const suffix = String(Date.now());
try {
  async function context(session) {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    if (session)
      await c.addCookies([{ name: "session_id", value: session, url: origin }]);
    await c.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    return c;
  }
  const admin = await context("kids-preview-admin");
  const parent = await context("kids-preview-parent");
  const page = await admin.newPage();
  const parentPage = await parent.newPage();
  const names = [`FamilyOnly${suffix}`, `Unrelated${suffix}`];
  const created = [];
  for (const firstName of names) {
    const response = await admin.request.post(origin + "/api/people", {
      data: {
        action: "create",
        profileType: "adult",
        firstName,
        lastName: "Test",
      },
    });
    assert.equal(response.status(), 201);
    created.push((await response.json()).id);
  }
  const profiles = (
    await (await admin.request.get(origin + "/api/people")).json()
  ).people;
  const member = profiles.find((p) => p.id === created[0]);
  const parentProfile = profiles.find(
    (p) => p.firstName === "Preview" && p.lastName === "Parent",
  );
  assert.ok(
    (
      await admin.request.post(origin + "/api/exchange/groups/9000/people", {
        data: { action: "add", personId: parentProfile.id },
      })
    ).ok(),
  );
  await parentPage.goto(origin + "/lists");
  assert.equal(
    await parentPage.getByText(names[0] + " Test", { exact: true }).count(),
    0,
  );
  await page.goto(origin + "/admin/groups/9000");
  const section = page.getByRole("region", {
    name: "Family members outside the exchange",
    exact: true,
  });
  await section
    .getByLabel("Add family member outside exchange", { exact: true })
    .selectOption(String(member.id));
  await section
    .getByRole("button", { name: "Add family member", exact: true })
    .click();
  await section
    .getByText(names[0] + " Test — wishlist only", { exact: true })
    .waitFor();
  await parentPage.reload();
  await parentPage.getByRole("link", { name: new RegExp(names[0]) }).click();
  await parentPage.waitForURL(origin + "/lists/" + member.accountId);
  assert.equal(
    await parentPage.getByText(names[1] + " Test", { exact: true }).count(),
    0,
  );
  const session = "family-browser-" + suffix;
  const command = `INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES('${session}',${Number(member.accountId)},'2999-01-01',CURRENT_TIMESTAMP); SELECT count(*) n FROM exchange_group_members WHERE group_id=9000 AND user_id=${Number(member.accountId)};`;
  const query = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "d1",
        "execute",
        "wishlist",
        "--local",
        "--command=" + command,
        "--json",
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(query.at(-1).results[0].n, 0);
  const family = await context(session),
    familyPage = await family.newPage();
  await familyPage.goto(origin + "/lists");
  await familyPage.getByText("Preview Parent", { exact: true }).waitFor();
  assert.equal(
    await familyPage.getByText(names[1] + " Test", { exact: true }).count(),
    0,
  );
  assert.equal(
    (
      await family.request.post(origin + "/api/exchange/groups/9000/people", {
        data: { action: "add-family", personId: created[1] },
      })
    ).status(),
    403,
  );
  await section
    .getByRole("listitem")
    .filter({ hasText: names[0] })
    .getByRole("button", { name: "Remove family access", exact: true })
    .click();
  await section
    .getByText(names[0] + " Test — wishlist only", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    (await parent.request.get(origin + "/lists/" + member.accountId)).status(),
    404,
  );
  await parentPage.goto(origin + "/lists");
  assert.equal(
    await parentPage.getByText(names[0] + " Test", { exact: true }).count(),
    0,
  );
  console.log(
    "PASS: mobile UI add/remove, reciprocal list access, unrelated-family privacy, no draw entry, admin-only mutation, and direct-link revocation",
  );
} finally {
  await browser.close();
}
