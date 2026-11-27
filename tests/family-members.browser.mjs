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
    name: "Group members",
    exact: true,
  });
  await section
    .getByLabel("Add group member", { exact: true })
    .selectOption(String(member.id));
  await section
    .getByRole("button", { name: "Add member", exact: true })
    .click();
  const card = section
    .getByRole("listitem")
    .filter({ hasText: names[0] + " Test" });
  const participation = card.getByRole("checkbox", {
    name: "In the exchange: " + names[0] + " Test",
    exact: true,
  });
  await participation.waitFor();
  assert.equal(await participation.isChecked(), false);
  await participation.check();
  await page.waitForFunction(
    () => document.querySelector('[aria-busy="true"]') === null,
  );
  await participation.uncheck();
  await page.waitForFunction(
    () => document.querySelector('[aria-busy="true"]') === null,
  );
  await page.reload();
  assert.equal(await participation.isChecked(), false);
  assert.equal(await card.count(), 1);
  const mobileColumns = await section
    .getByRole("list", { name: "Member roster" })
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  assert.equal(mobileColumns, 1);
  await page.setViewportSize({ width: 1100, height: 900 });
  const desktopColumns = await section
    .getByRole("list", { name: "Member roster" })
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  assert.equal(desktopColumns, 2);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/wishlist-browser-feedback-check/unified-roster-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/wishlist-browser-feedback-check/unified-roster-mobile.png",
    fullPage: true,
  });
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
        data: { action: "add-member", personId: created[1] },
      })
    ).status(),
    403,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await card
    .getByRole("button", {
      name: "Remove " + names[0] + " Test from group",
      exact: true,
    })
    .click();
  await card.waitFor({ state: "hidden" });
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
    "PASS: responsive one/two-column roster, checkbox persistence, reciprocal list access, family privacy, admin-only changes and removal revocation",
  );
} finally {
  await browser.close();
}
