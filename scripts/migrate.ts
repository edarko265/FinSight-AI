import { loadEnv } from "./load-env";

loadEnv();

async function main(): Promise<void> {
  const { getDb } = await import("@/lib/db/client");
  const { migrate } = await import("@/lib/db/migrate");
  const db = await getDb();
  const ran = await migrate(db);
  console.log(ran.length > 0 ? `Applied: ${ran.join(", ")}` : "Database is up to date.");
  await db.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exit(1);
});
