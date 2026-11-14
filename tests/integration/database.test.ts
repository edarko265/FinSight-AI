import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migrations and server modules against an in-memory PostgreSQL
 * (PGlite). No network and no bank data: everything here is made up.
 */
process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.BLIND_INDEX_KEY = randomBytes(32).toString("base64");
process.env.SESSION_SECRET = randomBytes(32).toString("base64");
process.env.DATA_ENCRYPTION_KEY_ID = "k1";

type Db = import("@/lib/db/client").Db;
let db: Db;
let refA: string;
let refB: string;

beforeAll(async () => {
  const { getDb } = await import("@/lib/db/client");
  const { migrate } = await import("@/lib/db/migrate");
  const { customerKey, customerRef } = await import("@/lib/security/keys");
  const { sealLedger, sealProfile } = await import("@/lib/data/ledger-codec");
  db = await getDb();
  await migrate(db);
  await db.query(
    "INSERT INTO ingestions (id, source_file, source_sha256, status) VALUES ('i1', 'fixture', 'x', 'complete')",
  );
  for (const id of ["TESTA", "TESTB"]) {
    const ref = customerRef(id);
    const key = customerKey(ref);
    await db.query(
      "INSERT INTO customer_ledgers (customer_ref, key_id, ingestion_id, sealed_profile, sealed_ledger) VALUES ($1, 'k1', 'i1', $2, $3)",
      [
        ref,
        sealProfile({ customerId: id, accountId: `ACC-${id}`, age: 30, postalCode: "00100" }, key),
        sealLedger(
          [
            {
              row: 1,
              date: "2026-08-01",
              time: "10:00:00",
              amountCents: -1234,
              balanceCents: 5000,
              category: "Groceries",
              type: "purchase",
              merchantId: null,
              mcc: "5411",
            },
          ],
          key,
        ),
      ],
    );
  }
  refA = customerRef("TESTA");
  refB = customerRef("TESTB");
});

describe("migrations", () => {
  it("apply cleanly and are safe to run again", async () => {
    const { migrate } = await import("@/lib/db/migrate");
    expect(await migrate(db)).toEqual([]);
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(tables.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "customer_ledgers",
        "sessions",
        "customer_state",
        "usage_events",
        "advisor_requests",
        "app_settings",
        "admin_audit",
        "rate_limits",
      ]),
    );
  });
});

describe("data at rest", () => {
  it("stores nothing readable: no customer ID, category or amount in any column", async () => {
    const rows = await db.query<Record<string, unknown>>("SELECT * FROM customer_ledgers");
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("TESTA");
    expect(dump).not.toContain("Groceries");
    expect(dump).not.toContain("1234");
    expect(dump).not.toContain("00100");
  });

  it("returns a customer only by their own blind index, and only up to the as-of date", async () => {
    const { findCustomerRef, loadCustomer } = await import("@/lib/data/repository");
    expect(await findCustomerRef("TESTA")).toBe(refA);
    expect(await findCustomerRef("NOBODY")).toBeNull();
    const record = await loadCustomer(refA);
    expect(record?.profile.customerId).toBe("TESTA");
    expect(record?.transactions).toHaveLength(1);
  });

  it("keeps one customer's saved state unreadable with another customer's key", async () => {
    const { readState, writeState } = await import("@/lib/data/repository");
    await writeState(refA, "goals", [{ name: "secret goal" }]);
    expect(await readState(refA, "goals")).toEqual([{ name: "secret goal" }]);
    expect(await readState(refB, "goals")).toBeNull();
    const raw = await db.query<{ sealed_value: string }>("SELECT sealed_value FROM customer_state");
    expect(raw[0]?.sealed_value).not.toContain("secret goal");
    // Move A's ciphertext under B: it must fail to open, not leak.
    await db.query(
      "INSERT INTO customer_state (customer_ref, kind, sealed_value) VALUES ($1, 'goals', $2)",
      [refB, raw[0]?.sealed_value],
    );
    await expect(readState(refB, "goals")).rejects.toThrow();
    await db.query("DELETE FROM customer_state WHERE customer_ref = $1", [refB]);
  });
});

describe("consent", () => {
  it("requires the terms before AI can be switched on, and records withdrawal", async () => {
    const consent = await import("@/lib/coach/consent");
    expect(consent.hasAcceptedTerms(await consent.readConsent(refA))).toBe(false);
    // AI consent recorded without terms does not count.
    await consent.setAiConsent(refA, true);
    expect(consent.hasAiConsent(await consent.readConsent(refA))).toBe(false);
    await consent.acceptTerms(refA);
    expect(consent.hasAiConsent(await consent.readConsent(refA))).toBe(true);
    const withdrawn = await consent.setAiConsent(refA, false);
    expect(consent.hasAiConsent(withdrawn)).toBe(false);
    expect(consent.hasDecidedOnAi(withdrawn)).toBe(true);
    expect(withdrawn.withdrawnAt).not.toBeNull();
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then refuses, and stores only a hash of the key", async () => {
    const { rateLimit } = await import("@/lib/security/session");
    const results = [];
    for (let attempt = 0; attempt < 5; attempt += 1)
      results.push(await rateLimit("login:203.0.113.9", 3, 60_000));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await rateLimit("login:198.51.100.1", 3, 60_000)).toBe(true);
    const rows = await db.query<{ key: string }>("SELECT key FROM rate_limits");
    expect(JSON.stringify(rows)).not.toContain("203.0.113.9");
  });
});

describe("sign-in lockout", () => {
  it("counts only failures, refuses everything while locked, and clears on success", async () => {
    const { clearFailures, isLockedOut, recordFailure } = await import("@/lib/security/session");
    const key = "login-id:TESTA";
    expect(await isLockedOut(key, 3, 60_000)).toBe(false);
    for (let attempt = 0; attempt < 3; attempt += 1) await recordFailure(key, 60_000);
    expect(await isLockedOut(key, 3, 60_000)).toBe(true);
    await clearFailures(key);
    expect(await isLockedOut(key, 3, 60_000)).toBe(false);
  });
});

describe("anonymous usage statistics", () => {
  it("counts topics per day with no customer reference or text", async () => {
    const { recordUsage, usageSummary } = await import("@/lib/admin/usage");
    await recordUsage("question", "spending", "fi", "ai");
    await recordUsage("question", "spending", "fi", "ai");
    await recordUsage("question", "none", "en", "basic");
    await recordUsage("unanswered", "loans", "en", "basic");
    const summary = await usageSummary();
    expect(summary.totalQuestions).toBe(3);
    expect(summary.byTopic[0]).toEqual({ topic: "spending", count: 2 });
    expect(summary.unanswered).toBe(1);
    expect(summary.unansweredThemes).toEqual([{ topic: "loans", count: 1 }]);
    const columns = await db.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_events'",
    );
    expect(columns.map((row) => row.column_name).sort()).toEqual([
      "count",
      "day",
      "kind",
      "locale",
      "mode",
      "topic",
    ]);
  });
});

describe("admin settings", () => {
  it("fall back to defaults, save, and validate", async () => {
    const { DEFAULT_SETTINGS, getSettings, saveSettings, settingsSchema } =
      await import("@/lib/admin/settings");
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({
      ...DEFAULT_SETTINGS,
      advisorFeeCents: 2900,
      features: { ...DEFAULT_SETTINGS.features, ai: false },
    });
    const saved = await getSettings();
    expect(saved.advisorFeeCents).toBe(2900);
    expect(saved.features.ai).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, advisorFeeCents: -1 }).success).toBe(
      false,
    );
    await saveSettings(DEFAULT_SETTINGS);
  });
});

describe("adviser hand-over", () => {
  it("is free the first time, charged after, sealed at rest, and fully recoverable from the bin", async () => {
    const handoff = await import("@/lib/advisor/handoff");
    expect(await handoff.nextFeeCents(refA)).toBe(0);
    const request = await handoff.createRequest(refA, {
      topic: "investment",
      slot: "2026-09-16T10:00",
      note: "private note",
    });
    expect(request.feeCents).toBe(0);
    expect(await handoff.nextFeeCents(refA)).toBe(1900);

    const stored = await db.query<Record<string, unknown>>(
      "SELECT * FROM advisor_requests UNION ALL SELECT id, request_id, sender, sender, sealed_text, created_at, created_at, NULL FROM advisor_messages",
    );
    expect(JSON.stringify(stored)).not.toContain("private note");

    const [queued] = await handoff.advisorQueue();
    expect(queued?.alias).toMatch(/^#[0-9A-F]{6}$/);
    expect(JSON.stringify(queued)).not.toContain("TESTA");
    expect(queued?.waitingForAdvisor).toBe(true);

    await handoff.advisorReply(request.id, "Hello from the adviser");
    expect((await handoff.currentRequest(refA))?.messages.map((message) => message.sender)).toEqual(
      ["customer", "advisor"],
    );
    expect(await handoff.currentRequest(refB)).toBeNull();

    await handoff.setRequestState(request.id, "trash");
    expect(await handoff.currentRequest(refA)).toBeNull();
    await handoff.setRequestState(request.id, "restore");
    expect(await handoff.currentRequest(refA)).not.toBeNull();
    // Permanent delete only works from the bin.
    await handoff.setRequestState(request.id, "purge");
    expect(await handoff.advisorThread(request.id)).not.toBeNull();
    await handoff.setRequestState(request.id, "trash");
    await handoff.setRequestState(request.id, "purge");
    expect(await handoff.advisorThread(request.id)).toBeNull();
  });
});

describe("announcements", () => {
  it("support create, edit, bin, restore and permanent delete", async () => {
    const a = await import("@/lib/admin/announcements");
    await a.createAnnouncement({ title: "Hello", body: "First", severity: "info" });
    const [created] = await a.listAnnouncements();
    await a.updateAnnouncement(created!.id, {
      title: "Hello again",
      body: "Edited",
      severity: "good",
    });
    expect((await a.activeAnnouncements())[0]).toMatchObject({
      title: "Hello again",
      severity: "good",
    });
    await a.countAnnouncementViews([created!.id]);
    expect((await a.listAnnouncements())[0]?.views).toBe(1);
    await a.setAnnouncementState(created!.id, "trash");
    expect(await a.activeAnnouncements()).toEqual([]);
    await a.setAnnouncementState(created!.id, "restore");
    expect(await a.activeAnnouncements()).toHaveLength(1);
    await a.setAnnouncementState(created!.id, "trash");
    await a.setAnnouncementState(created!.id, "purge");
    expect(await a.listAnnouncements()).toEqual([]);
  });
});

describe("staff accounts", () => {
  it("sign in with their own password, and lose access in the recycle bin", async () => {
    const staff = await import("@/lib/admin/staff");
    expect(
      await staff.createStaff({
        name: "Aino Virtanen",
        username: "Aino.Virtanen",
        role: "adviser",
        password: "correct-horse-1",
      }),
    ).toBe(true);
    // The same username again is refused, whatever its capitalisation.
    expect(
      await staff.createStaff({
        name: "Someone Else",
        username: "aino.virtanen",
        role: "admin",
        password: "another-pass-2",
      }),
    ).toBe(false);

    const member = await staff.verifyStaff("aino.virtanen", "correct-horse-1");
    expect(member).toMatchObject({ name: "Aino Virtanen", role: "adviser" });
    expect(await staff.verifyStaff("aino.virtanen", "wrong-password")).toBeNull();
    expect(await staff.verifyStaff("nobody", "correct-horse-1")).toBeNull();

    await staff.updateStaff(member!.id, {
      name: "Aino V.",
      role: "banker",
      password: "new-password-3",
    });
    expect(await staff.verifyStaff("aino.virtanen", "correct-horse-1")).toBeNull();
    expect(await staff.verifyStaff("aino.virtanen", "new-password-3")).toMatchObject({
      name: "Aino V.",
      role: "banker",
    });

    await staff.setStaffState(member!.id, "trash");
    expect(await staff.verifyStaff("aino.virtanen", "new-password-3")).toBeNull();
    expect(await staff.activeStaff(member!.id)).toBeNull();
    await staff.setStaffState(member!.id, "restore");
    expect(await staff.activeStaff(member!.id)).not.toBeNull();
    await staff.setStaffState(member!.id, "trash");
    await staff.setStaffState(member!.id, "purge");
    expect(await staff.listStaff()).toEqual([]);
  });

  it("stores no name, username or password in readable form", async () => {
    const staff = await import("@/lib/admin/staff");
    await staff.createStaff({
      name: "Readable Name",
      username: "readable.user",
      role: "admin",
      password: "readable-secret-9",
    });
    const rows = await db.query<Record<string, unknown>>("SELECT * FROM staff_users");
    const stored = JSON.stringify(rows);
    for (const secret of ["Readable Name", "readable.user", "readable-secret-9", '"admin"']) {
      expect(stored).not.toContain(secret);
    }
    const [member] = await staff.listStaff();
    await staff.setStaffState(member!.id, "trash");
    await staff.setStaffState(member!.id, "purge");
  });
});

describe("taught answers", () => {
  it("are given for a matching question, in the customer's language, and counted", async () => {
    const taught = await import("@/lib/coach/taught");
    await taught.createTaught({
      theme: "loans",
      keywords: [],
      answers: { en: "General loan answer", fi: "Yleinen lainavastaus", sv: "" },
    });
    await taught.createTaught({
      theme: "loans",
      keywords: ["student loan", "opintolaina"],
      answers: { en: "Student loan answer", fi: "", sv: "" },
    });

    expect(await taught.findTaught("Can I get a mortgage?", "en")).toBe("General loan answer");
    expect(await taught.findTaught("Saanko asuntolainaa?", "fi")).toBe("Yleinen lainavastaus");
    // No Swedish text was written, so English is used.
    expect(await taught.findTaught("Kan jag få bolån?", "sv")).toBe("General loan answer");
    // The more specific answer wins when its keyword appears.
    expect(await taught.findTaught("How do I repay my student loan?", "en")).toBe(
      "Student loan answer",
    );
    expect(await taught.findTaught("What is the weather?", "en")).toBeNull();

    const all = await taught.listTaught();
    expect(all.reduce((sum, answer) => sum + answer.uses, 0)).toBe(4);

    // In the recycle bin an answer is no longer given.
    for (const answer of all) await taught.setTaughtState(answer.id, "trash");
    expect(await taught.findTaught("Can I get a mortgage?", "en")).toBeNull();
    for (const answer of all) await taught.setTaughtState(answer.id, "purge");
    expect(await taught.listTaught()).toEqual([]);
  });
});

describe("shared plans", () => {
  it("publish percentages only, can be copied by code, and stop when unshared or binned", async () => {
    const plans = await import("@/lib/coach/plans");
    const { TEMPLATES } = await import("@/lib/coach/plan-math");
    const { loadCustomer } = await import("@/lib/data/repository");
    const contextFor = async (ref: string) => ({
      customerRef: ref,
      record: (await loadCustomer(ref))!,
      asOf: "2026-09-15",
      locale: "en" as const,
      benchmarks: [],
    });
    const alice = await contextFor(refA);
    const bob = await contextFor(refB);

    expect(
      await plans.createPlan(alice, {
        name: "Save 5000 €",
        split: TEMPLATES.saver,
        origin: "template",
      }),
    ).toBe("name_has_amount");
    const created = await plans.createPlan(alice, {
      name: "Student budget",
      split: TEMPLATES.saver,
      origin: "template",
      goals: [{ label: "Engagement ring", percent: 100 }],
    });
    if (typeof created === "string") throw new Error(created);

    const shared = await plans.sharePlan(alice, created.id, { listed: true, showGoalNames: false });
    if (typeof shared === "string") throw new Error(shared);
    const code = shared.shareCode!;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);

    // What is public: the name and percentages. The goal name was hidden.
    const open = await plans.sharedPlan(code.toLowerCase());
    expect(open).toMatchObject({ name: "Student budget", split: TEMPLATES.saver, copies: 0 });
    expect(open?.goals).toEqual([{ label: "#1", percent: 100 }]);
    expect(Object.keys(open!).sort()).toEqual([
      "code",
      "copies",
      "goals",
      "listed",
      "name",
      "split",
    ]);

    // The stored row holds no customer reference and nothing readable.
    const rows = await db.query<Record<string, unknown>>("SELECT * FROM shared_plans");
    const stored = JSON.stringify(rows);
    for (const secret of [refA, "Student budget", "Engagement ring", "TESTA"]) {
      expect(stored).not.toContain(secret);
    }

    expect(await plans.listedPlans()).toHaveLength(1);
    const copy = await plans.copyPlan(bob, code);
    expect(copy).toMatchObject({
      name: "Student budget",
      origin: "copied",
      split: TEMPLATES.saver,
    });
    expect((await plans.sharedPlan(code))?.copies).toBe(1);
    // The copy is Bob's own and is not itself shared.
    expect((await plans.listPlans(bob))[0]?.shareCode).toBeUndefined();

    // Editing the original updates what is shared.
    await plans.updatePlan(alice, created.id, {
      name: "Student budget",
      split: TEMPLATES.balanced,
    });
    expect((await plans.sharedPlan(code))?.split).toEqual(TEMPLATES.balanced);

    // Moving it to the recycle bin ends the sharing.
    expect(await plans.deletePlan(alice, created.id)).toBe(true);
    expect(await plans.sharedPlan(code)).toBeNull();
    expect(await plans.copyPlan(bob, code)).toBe("not_found");
    expect(await plans.listPlans(alice)).toEqual([]);
  });
});
