import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_CUSTOMER, E2E_DEMO_PASSWORD, E2E_PORT } from "./env";

/** The app refuses writes that do not come from its own address, so requests say where they are from. */
const HEADERS = { Origin: `http://localhost:${E2E_PORT}` };

/** Signs a customer in through the API and accepts the terms, so a test starts on a real screen. */
export async function signIn(page: Page, customerId = E2E_CUSTOMER): Promise<void> {
  // The first-use notification prompt is not what these tests are about.
  await page.addInitScript(() => window.localStorage.setItem("fs_notify_asked", "1"));
  // Sign-ins are limited per visitor address. Each test is its own visitor, so the suite
  // as a whole does not run into the limit that one address would.
  const visitor = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
  const login = await page.request.post("/api/auth/login", {
    data: { customerId, password: E2E_DEMO_PASSWORD },
    headers: { ...HEADERS, "x-forwarded-for": visitor },
  });
  expect(login.ok()).toBe(true);
  const consent = await page.request.post("/api/consent", {
    data: { terms: true, accepted: false },
    headers: HEADERS,
  });
  expect(consent.ok()).toBe(true);
}

export async function signInAsOwner(page: Page): Promise<void> {
  const login = await page.request.post("/api/admin/login", {
    data: { password: E2E_ADMIN_PASSWORD },
    headers: HEADERS,
  });
  expect(login.ok()).toBe(true);
}

/** No serious or critical accessibility problems that an automated audit can find. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map((violation) => `${violation.id}: ${violation.nodes[0]?.html.slice(0, 140)}`),
  ).toEqual([]);
}
