import { loadEnv } from "./load-env";

loadEnv();

/** Connects to the configured database and reports what is there. Reads only. */
async function main(): Promise<void> {
  const { getDb } = await import("@/lib/db/client");
  const db = await getDb();
  const info = await db.query<{ version: string; tables: string }>(
    `SELECT version() AS version,
            (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public')::text AS tables`,
  );
  console.log(`Connected: ${info[0]?.version.split(" ").slice(0, 2).join(" ")}`);
  console.log(`Tables in public schema: ${info[0]?.tables}`);
  if (Number(info[0]?.tables) > 0) {
    const counts = await db
      .query<{ customers: string }>("SELECT count(*)::text AS customers FROM customer_ledgers")
      .catch(() => []);
    console.log(`Customers loaded: ${counts[0]?.customers ?? "table not created yet"}`);
  } else {
    console.log("The database is empty. Run: pnpm data:ingest --source data/raw");
  }
  await db.close();
}

main().catch((error: unknown) => {
  console.error("Could not connect:", error instanceof Error ? error.message : error);
  process.exit(1);
});
