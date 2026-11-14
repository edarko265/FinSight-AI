import "server-only";

import { getSettings } from "@/lib/admin/settings";
import { availableProviders, getCoachModel } from "@/lib/coach/llm";
import { AI_TERMS_VERSION } from "@/lib/coach/consent";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";

export interface SystemStatus {
  customers: number;
  transactions: number;
  ingestedAt: string | null;
  sourceChecksum: string | null;
  benchmarkGroups: number;
  activeSessions: number;
  asOf: string;
  database: "postgres" | "embedded";
  encryption: { algorithm: string; keyId: string; perCustomerKeys: boolean };
  ai: { enabled: boolean; model: string | null; termsVersion: string; available: string[] };
  voice: boolean;
  /** Typical monthly spending by age group, from the anonymous benchmarks. */
  spendingByAge: { ageBand: string; groupSize: number; medianCents: number }[];
}

export async function systemStatus(): Promise<SystemStatus> {
  const db = await getDb();
  const env = getEnv();
  const ingestion = (
    await db.query<{
      customer_count: number;
      row_count: number;
      finished_at: string | Date | null;
      source_sha256: string;
    }>(
      "SELECT customer_count, row_count, finished_at, source_sha256 FROM ingestions WHERE status = 'complete' ORDER BY finished_at DESC LIMIT 1",
    )
  )[0];
  const customers = (
    await db.query<{ n: number | string }>("SELECT count(*) AS n FROM customer_ledgers")
  )[0];
  const sessions = (
    await db.query<{ n: number | string }>(
      "SELECT count(*) AS n FROM sessions WHERE expires_at > now()",
    )
  )[0];
  const benchmarks = await db.query<{
    age_band: string;
    group_size: number;
    p50_cents: number | string;
  }>(
    "SELECT age_band, group_size, p50_cents FROM peer_benchmarks WHERE metric = 'consumption' ORDER BY age_band",
  );
  const groups = (
    await db.query<{ n: number | string }>("SELECT count(*) AS n FROM peer_benchmarks")
  )[0];
  const model = getCoachModel((await getSettings()).aiProvider);
  return {
    customers: Number(customers?.n ?? 0),
    transactions: Number(ingestion?.row_count ?? 0),
    ingestedAt: ingestion?.finished_at ? new Date(ingestion.finished_at).toISOString() : null,
    sourceChecksum: ingestion?.source_sha256 ?? null,
    benchmarkGroups: Number(groups?.n ?? 0),
    activeSessions: Number(sessions?.n ?? 0),
    asOf: env.DEMO_AS_OF_DATE,
    database: env.DATABASE_URL ? "postgres" : "embedded",
    encryption: {
      algorithm: "AES-256-GCM",
      keyId: env.DATA_ENCRYPTION_KEY_ID,
      perCustomerKeys: true,
    },
    ai: {
      enabled: model !== null,
      model: model?.name ?? null,
      termsVersion: AI_TERMS_VERSION,
      available: availableProviders(),
    },
    voice: Boolean(env.ELEVENLABS_API_KEY),
    spendingByAge: benchmarks
      .filter((row) => row.age_band !== "all")
      .map((row) => ({
        ageBand: row.age_band,
        groupSize: Number(row.group_size),
        medianCents: Number(row.p50_cents),
      })),
  };
}
