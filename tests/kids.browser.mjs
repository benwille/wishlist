// Run against an isolated local preview seeded with tests/fixtures/kids-preview.sql.
// PLAYWRIGHT_MODULE may point to an existing shared playwright-core installation.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright-core"
);
const origin = process.env.KIDS_PREVIEW_ORIGIN || "http://localhost:8788";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
  "Use a local fixture database only",
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
  await page.goto(origin + "/admin/groups/9000/kids");
  for (let i = 1; i <= 6; i++) {
    await page
      .getByLabel("First name", { exact: true })
      .fill("Preview Kid " + i);
    await page.getByLabel("Last name", { exact: true }).fill("Test");
    for (const name of [
      "Preview Admin",
      "Preview Parent",
      "Preview Third",
      "Preview Fourth",
    ])
      await page.getByRole("checkbox", { name, exact: true }).check();
    await page
      .getByRole("button", { name: "Add to kids’ exchange", exact: true })
      .click();
    await page
      .getByRole("heading", { name: `Kids (${i})`, exact: true })
      .waitFor();
  }
  for (let i = 1; i <= 6; i += 2) {
    await page
      .getByLabel("Excluded child 1")
      .selectOption({ label: `Preview Kid ${i} Test` });
    await page
      .getByLabel("Excluded child 2")
      .selectOption({ label: `Preview Kid ${i + 1} Test` });
    await page
      .getByRole("button", { name: "Add exclusion", exact: true })
      .click();
    await page
      .getByText(`Preview Kid ${i} Test / Preview Kid ${i + 1} Test`, {
        exact: true,
      })
      .waitFor();
  }
  await page
    .getByRole("button", { name: "Generate preview", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: `Preview for ${new Date().getFullYear()}`,
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Save assignments", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Kids’ assignment history", exact: true })
    .locator("..")
    .getByRole("heading", {
      name: String(new Date().getFullYear()),
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "admin fits mobile width",
  );
  await context.addCookies([
    { name: "session_id", value: "kids-preview-parent", url: origin },
  ]);
  await page.goto(origin + "/");
  await page
    .getByRole("heading", {
      name: `Your kids’ ${new Date().getFullYear()} assignments`,
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .locator("section")
      .filter({ hasText: "Your kids’" })
      .locator("p.font-medium")
      .count(),
    6,
  );
  await page.goto(origin + "/exchange/9000");
  await page.getByRole("heading", { name: "Adults", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Kids", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "family view fits mobile width",
  );
  console.log(
    "Browser smoke passed: six kids, four adult links each, exclusions, preview/save, parent homepage and family draw at mobile width.",
  );
} finally {
  await browser.close();
}
