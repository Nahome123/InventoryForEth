import path from "node:path";
import fs from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/** Both drivers expose the same query-builder API; we type against node-postgres. */
export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

const migrationsFolder = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

export async function createDb(opts: { databaseUrl?: string; pgliteDir?: string; inMemory?: boolean }): Promise<DB> {
  if (opts.databaseUrl) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(new Pool({ connectionString: opts.databaseUrl, max: 5 }), { schema });
    await migrate(db, { migrationsFolder });
    await ensureSettingsRow(db);
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  let client;
  if (opts.inMemory) {
    client = new PGlite();
  } else {
    const dir = path.resolve(/*turbopackIgnore: true*/ opts.pgliteDir || "./data/pglite");
    fs.mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  }
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  await ensureSettingsRow(db as unknown as DB);
  return db as unknown as DB;
}

async function ensureSettingsRow(db: DB) {
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
}
