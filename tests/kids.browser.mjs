// Run only against a local preview with tests/fixtures/kids-preview.sql.
// This exercises the shared People flow; existing children must survive migration.
import assert from "node:assert/strict";
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await context.addCookies([
    { name: "session_id", value: "kids-preview-admin", url: origin },
  ]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(origin + "/admin/users");
  await page.getByRole("heading", { name: "People", exact: true }).waitFor();
  const names = [`SharedKidA${suffix}`, `SharedKidB${suffix}`];
  for (const first of names) {
    await page.getByLabel("Person type", { exact: true }).selectOption("child");
    await page.getByLabel("First name", { exact: true }).fill(first);
    await page.getByLabel("Last name", { exact: true }).fill("Test");
    for (const adult of [
      "Preview Admin",
      "Preview Parent",
      "Preview Third",
      "Preview Fourth",
    ])
      await page.getByRole("checkbox", { name: adult, exact: true }).check();
    await page
      .getByRole("button", { name: "Create person", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Edit ${first}`, exact: true })
      .waitFor();
  }
  const profiles = await (
    await context.request.get(origin + "/api/people")
  ).json();
  const kids = profiles.people.filter((p) => names.includes(p.firstName));
  assert.equal(kids.length, 2);
  assert.ok(kids.every((p) => p.guardianIds.length === 4));
  await page
    .getByRole("button", { name: `Edit ${names[0]}`, exact: true })
    .click();
  await page
    .getByRole("heading", { name: `Edit ${names[0]}`, exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByLabel("First name", { exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Cancel edit", exact: true }).click();
  await page.goto(origin + "/admin/groups/9000");
  const firstGroup = page.getByRole("region", {
    name: "Kids members",
    exact: true,
  });
  assert.equal(
    await firstGroup
      .getByRole("button", { name: `Remove ${names[0]}`, exact: true })
      .count(),
    0,
  );
  await page
    .getByLabel("Add child participant", { exact: true })
    .selectOption(String(kids[0].id));
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await firstGroup
    .getByRole("button", { name: `Remove ${names[0]}`, exact: true })
    .waitFor();
  const created = await context.request.post(origin + "/api/exchange/groups", {
    data: { name: `Friends ${suffix}` },
  });
  assert.ok(created.ok());
  const group = await created.json();
  await page.goto(origin + `/admin/groups/${group.id}`);
  await page
    .getByRole("checkbox", { name: "Kids exchange enabled", exact: true })
    .check();
  await page.waitForFunction(() => !document.querySelector("[aria-busy=true]"));
  for (const kid of kids) {
    await page
      .getByLabel("Add child participant", { exact: true })
      .selectOption(String(kid.id));
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    await page
      .getByRole("button", { name: `Remove ${kid.firstName}`, exact: true })
      .waitFor();
  }
  for (const [index, kid] of kids.entries())
    await page
      .getByLabel(`Child exclusion ${index + 1}`, { exact: true })
      .selectOption(String(kid.id));
  await page
    .getByRole("button", { name: "Add kids’ exclusion", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Kids exclusions", exact: true })
    .getByRole("button", { name: "Remove exclusion", exact: true })
    .waitFor();
  await page
    .getByRole("region", { name: "Kids exclusions", exact: true })
    .getByRole("button", { name: "Remove exclusion", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Kids exclusions", exact: true })
    .getByRole("button", { name: "Remove exclusion", exact: true })
    .waitFor({ state: "hidden" });
  const draw = page.getByRole("region", { name: "Kids draw", exact: true });
  await page.getByLabel("Kids draw year", { exact: true }).fill("2050");
  await draw
    .getByRole("button", { name: "Preview kids’ draw", exact: true })
    .click();
  await draw
    .getByRole("button", { name: "Save kids’ assignments", exact: true })
    .waitFor();
  await draw
    .getByRole("button", { name: "Save kids’ assignments", exact: true })
    .click();
  await draw
    .getByRole("button", { name: "Save kids’ assignments", exact: true })
    .waitFor({ state: "hidden" });
  // Exercise the adult controls on the same page and keep the kids draw intact.
  const adultProfiles = ["Admin", "Parent"].map((lastName) =>
    profiles.people.find(
      (p) => p.firstName === "Preview" && p.lastName === lastName,
    ),
  );
  for (const adult of adultProfiles) {
    await page
      .getByLabel("Add adult participant", { exact: true })
      .selectOption(String(adult.id));
    await page.getByRole("button", { name: "Add adult", exact: true }).click();
    await page
      .getByRole("region", { name: "Adult members", exact: true })
      .getByText(`${adult.firstName} ${adult.lastName}`, { exact: true })
      .waitFor();
  }
  for (const [index, adult] of adultProfiles.entries())
    await page
      .getByLabel(`Adult exclusion ${index + 1}`, { exact: true })
      .selectOption(String(adult.id));
  await page
    .getByRole("button", { name: "Add adult exclusion", exact: true })
    .click();
  const adultExclusions = page.getByRole("region", {
    name: "Adult exclusions",
    exact: true,
  });
  await adultExclusions
    .getByRole("button", { name: "Remove exclusion", exact: true })
    .click();
  await adultExclusions
    .getByRole("button", { name: "Remove exclusion", exact: true })
    .waitFor({ state: "hidden" });
  const adultDraw = page.getByRole("region", {
    name: "Adult draw",
    exact: true,
  });
  await page.getByLabel("Adult draw year", { exact: true }).fill("2050");
  await adultDraw
    .getByRole("button", { name: "Preview adult draw", exact: true })
    .click();
  await adultDraw
    .getByRole("button", { name: "Save adult assignments", exact: true })
    .click();
  await adultDraw
    .getByRole("button", { name: "Save adult assignments", exact: true })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("link", { name: "View all assignments", exact: true })
    .click();
  const year = page.getByRole("region", { name: "2050", exact: true });
  await year.getByRole("heading", { name: "Kids", exact: true }).waitFor();
  assert.equal(
    await year
      .getByRole("region", { name: "Kids", exact: true })
      .locator("p")
      .count(),
    2,
  );
  assert.equal(
    await year
      .getByRole("region", { name: "Adults", exact: true })
      .locator("p")
      .count(),
    2,
  );
  for (const kid of kids)
    await year
      .getByRole("region", { name: "Kids", exact: true })
      .getByText(new RegExp(kid.firstName))
      .first()
      .waitFor();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
  }
  await context.addCookies([
    { name: "session_id", value: "kids-preview-parent", url: origin },
  ]);
  await page.goto(origin + "/people");
  await page
    .getByRole("button", { name: `Edit ${names[0]}`, exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Create person", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByRole("checkbox").count(), 0);
  const visible = await (
    await context.request.get(origin + "/api/people")
  ).json();
  assert.deepEqual(visible.adults, []);
  assert.ok(visible.people.every((p) => p.guardianIds === undefined));
  assert.equal(
    (
      await context.request.post(origin + "/api/people", {
        data: {
          action: "edit",
          id: kids[0].id,
          firstName: "Hijack",
          lastName: "Test",
          guardianIds: [kids[1].id],
        },
      })
    ).status(),
    403,
  );
  await page.goto(origin + `/exchange/${group.id}`);
  await page.getByRole("heading", { name: "2050", exact: true }).waitFor();
  console.log(
    "Shared People browser passed: Users redirect, Child type, four adult links, scoped parent directory, profile reuse across two groups, group exclusions/settings, independent adult and kids draw saves, year columns, edit focus and mobile widths.",
  );
} finally {
  await browser.close();
}
