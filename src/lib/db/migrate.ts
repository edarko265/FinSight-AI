import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Db } from "@/lib/db/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");

/** Applies every pending .sql migration in name order. Safe to run repeatedly. */
export async function migrate(db: Db, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const applied = new Set(
    (await db.query<{ name: string }>("SELECT name FROM schema_migrations")).map((row) => row.name),
  );
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await db.exec(
      `BEGIN;\n${sql}\nINSERT INTO schema_migrations (name) VALUES ('${file.replace(/'/g, "''")}');\nCOMMIT;`,
    );
    ran.push(file);
  }
  return ran;
}
