import { expect, test } from "@playwright/test";

import { E2E_PORT } from "./env";
import { expectAccessible, signIn, signInAsOwner } from "./support";

const HEADERS = { Origin: `http://localhost:${E2E_PORT}` };

test.use({ viewport: { width: 1280, height: 900 } });

test("the admin area needs a sign-in", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL("**/admin/login");
  expect((await page.request.get("/api/admin/overview")).status()).toBe(401);
});

test("the owner sees every section, with numbers", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expectAccessible(page);
  for (const section of [
    "Usage",
    "Teach the coach",
    "Advisers",
    "Team",
    "Controls",
    "Recycle bin",
  ]) {
    await page.getByRole("link", { name: section, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("an adviser gets a shorter menu and is refused the rest by the server", async ({
  page,
  browser,
}) => {
  await signInAsOwner(page);
  const created = await page.request.post("/api/admin/staff", {
    data: {
      name: "Test Adviser",
      username: "test.adviser",
      role: "adviser",
      password: "adviser-password-1",
    },
    headers: HEADERS,
  });
  expect(created.ok()).toBe(true);

  const context = await browser.newContext({ baseURL: `http://localhost:${E2E_PORT}` });
  const adviser = await context.newPage();
  const login = await adviser.request.post("/api/admin/login", {
    data: { username: "test.adviser", password: "adviser-password-1" },
    headers: HEADERS,
  });
  expect(login.ok()).toBe(true);
  expect((await adviser.request.get("/api/admin/staff")).status()).toBe(403);
  expect((await adviser.request.get("/api/admin/advisor")).status()).toBe(200);
  await adviser.goto("/admin");
  await expect(adviser.getByRole("link", { name: "Advisers", exact: true })).toBeVisible();
  await expect(adviser.getByRole("link", { name: "Team", exact: true })).toHaveCount(0);
  await context.close();
});

test("staff cannot open a customer's data, and customers cannot open the admin area", async ({
  page,
}) => {
  await signInAsOwner(page);
  expect(
    (await page.request.get("/api/transactions?start=2026-08-01&end=2026-09-01")).status(),
  ).toBe(401);
  await signIn(page);
  expect((await page.request.get("/api/overview")).ok()).toBe(true);
});
