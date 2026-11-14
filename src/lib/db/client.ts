import { mkdirSync } from "node:fs";
import path from "node:path";

import { getEnv } from "@/lib/env";

/**
 * Minimal database access: parameterised SQL only.
 *
 * With DATABASE_URL set, connects to PostgreSQL over TLS. Without it, uses an
 * embedded PostgreSQL (PGlite) stored under data/derived/, so the project runs
 * locally with no external service. Either way the tables hold ciphertext.
 */
export interface Db {
  query<Row extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Row[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

async function connectPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  });
  return {
    async query(sql, params) {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

async function connectEmbedded(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "derived", "pglite");
  if (dir !== "memory") mkdirSync(path.dirname(dir), { recursive: true });
  const pg = dir === "memory" ? new PGlite() : new PGlite(dir);
  await pg.waitReady;
  return {
    async query(sql, params) {
      const result = await pg.query(sql, params);
      return result.rows as never;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}

const globalForDb = globalThis as unknown as { finsightDb?: Promise<Db> };

/** One shared connection per process (survives dev hot reloads). */
export function getDb(): Promise<Db> {
  if (!globalForDb.finsightDb) {
    const url = getEnv().DATABASE_URL;
    globalForDb.finsightDb = url ? connectPostgres(url) : connectEmbedded();
  }
  return globalForDb.finsightDb;
}
