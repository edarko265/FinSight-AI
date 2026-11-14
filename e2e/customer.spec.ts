import { expect, test } from "@playwright/test";

import { E2E_CUSTOMER, E2E_CUSTOMER_TIGHT, E2E_DEMO_PASSWORD, E2E_PORT } from "./env";
import { totpCode } from "../src/lib/security/totp";
import { expectAccessible, signIn } from "./support";

test("signs in through the step-by-step form and accepts the terms", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("fs_notify_asked", "1"));
  await page.goto("/login");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // A customer no other test signs in as, so this really is their first sign-in.
  await page.getByLabel("Customer ID").fill(E2E_CUSTOMER_TIGHT);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill(E2E_DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL("**/dashboard");
  // First sign-in: the terms come before anything of the customer's is shown.
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  const response = await page.request.post("/api/auth/login", {
    data: { customerId: E2E_CUSTOMER, password: "not-the-password" },
    headers: { Origin: `http://localhost:${E2E_PORT}` },
  });
  expect(response.status()).toBe(401);
});

test("a customer with two-step sign-in is asked for the code, and gets in with it", async ({
  page,
}) => {
  const headers = { Origin: `http://localhost:${E2E_PORT}` };
  const twoStep = (data: Record<string, string>) =>
    page.request.post("/api/security/totp", { data, headers });
  await signIn(page, E2E_CUSTOMER_TIGHT);
  const { secret } = (await (await twoStep({ action: "begin" })).json()) as { secret: string };
  expect((await twoStep({ action: "confirm", code: totpCode(secret, Date.now()) })).ok()).toBe(
    true,
  );
  try {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Customer ID").fill(E2E_CUSTOMER_TIGHT);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill(E2E_DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    // The password was right, so the form gains a step for the code instead of showing an error.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Six-digit code").fill(totpCode(secret, Date.now()));
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await page.waitForURL("**/dashboard");
  } finally {
    // Leave the customer as they were, so a second run can sign in without a code.
    await twoStep({ action: "disable", code: totpCode(secret, Date.now()) });
  }
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the dashboard shows the balance and what is safe to spend", async ({ page }) => {
    await page.goto("/dashboard");
    // The balance card; a balance widget on the dashboard may carry the same words.
    await expect(page.getByText("Recorded balance").first()).toBeVisible();
    await expect(page.getByText(/Safe to spend, next|Estimated shortfall, next/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
    // Recording income and expenses starts from the balance card.
    await expect(page.getByRole("button", { name: "Add income" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();
    // Nothing may scroll sideways on a phone.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expectAccessible(page);
  });

  test("the coach answers without AI and shows the transactions behind the answer", async ({
    page,
  }) => {
    await page.goto(
      `/chat?q=${encodeURIComponent("How much did I spend on restaurants last month?")}`,
    );
    await expect(page.getByText("Basic mode (no AI)")).toBeVisible();
    await page.getByRole("button", { name: /See transactions/ }).click();
    await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible();
    // Let the sheet finish opening before it is audited.
    await page.waitForTimeout(600);
    await expectAccessible(page);
  });

  test("a widget can be added, minimised and removed", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "New widget" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("The three baskets", { exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("radio", { name: "Tree map" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Add to dashboard" }).click();
    const card = page.locator("article").first();
    await expect(card.getByRole("heading")).toContainText("baskets");
    // The controls appear once the widget is picked up by its title.
    await card.getByRole("heading").click();
    await card.getByRole("button", { name: /^Minimise/ }).click();
    await expect(card.getByRole("button", { name: /^Open/ })).toBeVisible();
    await card.getByRole("button", { name: /^Remove/ }).click();
    await expect(page.getByText("Moved to the recycle bin")).toBeVisible();
  });

  test("a goal can be made and money set aside for it", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "Add a goal" }).click();
    await page.getByLabel("Name").fill("Summer trip");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Amount (€)").fill("1200");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Months").fill("12");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save goal" }).click();
    await expect(page.getByRole("heading", { name: "Summer trip" })).toBeVisible();

    await page.getByRole("button", { name: "Set money aside" }).click();
    await page.getByLabel("Amount, €").fill("100");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Mark as set aside" }).click();
    await expect(page.getByText(/Already set aside for goals: €100\.00/)).toBeVisible();
    await expectAccessible(page);
  });

  test("a plan can be made from an example and followed", async ({ page }) => {
    await page.goto("/plans");
    await page.getByRole("button", { name: "Make a plan" }).click();
    await page.getByText("Saver", { exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Student budget" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Adds up to 100 %")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Student budget" })).toBeVisible();
    await page.getByRole("button", { name: "Follow this plan" }).click();
    await expect(page.getByRole("button", { name: "Stop following" })).toBeVisible();
    await expectAccessible(page);
  });

  test("an account from another bank can be linked, and is labelled as simulated", async ({
    page,
  }) => {
    await page.goto("/accounts");
    await expect(page.getByText(/Other banks are simulated/)).toBeVisible();
    await page.getByRole("button", { name: "Link an account" }).click();
    for (let step = 0; step < 4; step += 1)
      await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Link the account" }).click();
    await expect(page.getByText("simulated", { exact: true })).toBeVisible();
    await expect(page.getByText(/2 accounts counted/)).toBeVisible();
    await expectAccessible(page);
  });

  test("settings, the mortgage guide and corrections open cleanly", async ({ page }) => {
    for (const [path, heading] of [
      ["/settings", "Settings"],
      ["/mortgage", "Mortgage guide"],
      ["/corrections", "My corrections"],
      ["/insights", "Insights"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
      await expectAccessible(page);
    }
  });

  test("an expense can be recorded, and says so when it breaks a monthly limit", async ({
    page,
  }) => {
    // A limit with room in it, so the expense below is what takes it over.
    const headers = { Origin: `http://localhost:${E2E_PORT}` };
    const set = (cents: number): Promise<unknown> =>
      page.request.post("/api/budgets", {
        data: { action: "set", target: "Restaurants", cents },
        headers,
      });
    await set(100_000);
    const { budgets } = (await (await page.request.get("/api/budgets")).json()) as {
      budgets: { target: string; spentCents: number }[];
    };
    const spent = budgets.find((budget) => budget.target === "Restaurants")?.spentCents ?? 0;
    await set(spent + 10_000);

    await page.goto("/entries");
    await expect(page.getByRole("heading", { name: "Income and expenses" })).toBeVisible();
    await page.getByRole("button", { name: "Add expense" }).click();
    await page.getByLabel("Amount in euros").fill("150");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("radio", { name: "Restaurants" }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Note (optional)").fill("Birthday dinner");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Balance after this")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("heading", { name: "Worth knowing" })).toBeVisible();
    await expect(page.getByText(/Restaurants/).first()).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText(/Birthday dinner/)).toBeVisible();
    await expectAccessible(page);

    // The amount can be changed afterwards.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Amount in euros").fill("175");
    for (let step = 0; step < 3; step += 1)
      await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("−€175.00")).toBeVisible();

    // To the recycle bin, and it is gone from the list.
    await page.getByRole("button", { name: "Move to recycle bin" }).click();
    await expect(page.getByText(/Nothing recorded yet/)).toBeVisible();

    // And back again from the bin.
    await page.goto("/trash");
    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.goto("/entries");
    await expect(page.getByText(/Birthday dinner/)).toBeVisible();
  });
});
