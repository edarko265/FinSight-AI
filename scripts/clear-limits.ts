import { loadEnv } from "./load-env";

loadEnv();

/** Clears request-limit counters, for example after automated testing locked an account out. */
async function main(): Promise<void> {
  const { getDb } = await import("@/lib/db/client");
  const db = await getDb();
  await db.query("DELETE FROM rate_limits");
  console.log("Request limits cleared.");
  await db.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
