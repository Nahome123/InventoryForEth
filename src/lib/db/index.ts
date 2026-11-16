import "server-only";
import { createDb, type DB } from "./client";

const g = globalThis as unknown as { __erpDb?: Promise<DB> };

/**
 * Returns the shared database, running migrations on first use.
 * Uses embedded PGlite (no server needed) unless DATABASE_URL is set.
 */
export function getDb(): Promise<DB> {
  if (!g.__erpDb) {
    if (process.env.VERCEL && !process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. The embedded database cannot run on Vercel; add a Postgres connection string in Project Settings → Environment Variables and redeploy.",
      );
    }
    g.__erpDb = createDb({ databaseUrl: process.env.DATABASE_URL, pgliteDir: process.env.PGLITE_DIR || "./data/pglite" }).catch((err) => {
      g.__erpDb = undefined;
      throw err;
    });
  }
  return g.__erpDb;
}

export type { DB, Tx } from "./client";
