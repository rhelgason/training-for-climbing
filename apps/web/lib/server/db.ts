/**
 * Postgres access for the API routes (Neon).
 *
 * Ported from the standalone Express server (`server/index.js`) when the backend
 * moved into Next route handlers. Two differences from the Express original:
 *
 *  - **Pool lifetime.** Serverless has no "boot": the pool lives at module scope
 *    so warm invocations reuse it, and is cached on `globalThis` so dev-server
 *    hot reloads don't leak a new pool per edit. Keep `max` small and point
 *    `DATABASE_URL` at Neon's *pooled* endpoint (the host containing `-pooler`)
 *    so many short-lived function instances don't exhaust the connection limit.
 *  - **Schema setup.** `ensureSchema()` used to run once before `listen()`. Here
 *    each handler awaits it and the promise is memoised per instance, so it runs
 *    at most once per cold start. The statements are `IF NOT EXISTS`, so this is
 *    idempotent and cheap; `scripts/schema.sql` has the same DDL if you'd rather
 *    apply it by hand.
 */
import { Pool } from 'pg';

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return new Pool({
    connectionString,
    // Neon requires TLS. `rejectUnauthorized: false` matches the previous
    // Railway deployment; set PGSSL=disable for a local plaintext Postgres.
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    // Small ceiling: many function instances × a large pool would blow through
    // Neon's connection limit. Three users don't need more than this.
    max: 3,
    idleTimeoutMillis: 10_000,
  });
}

const globalForDb = globalThis as typeof globalThis & {
  __tfcPool?: Pool;
  __tfcSchemaReady?: Promise<void>;
};

export function getPool(): Pool {
  if (!globalForDb.__tfcPool) globalForDb.__tfcPool = createPool();
  return globalForDb.__tfcPool;
}

async function migrate(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // One snapshot per user (FK to users; cascades on account deletion).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/** Create the schema if it isn't there yet. Memoised per warm instance. */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__tfcSchemaReady) {
    globalForDb.__tfcSchemaReady = migrate().catch((err) => {
      // Don't cache a failure — the next request should retry (e.g. the first
      // request after a cold start raced Neon waking from scale-to-zero).
      globalForDb.__tfcSchemaReady = undefined;
      throw err;
    });
  }
  return globalForDb.__tfcSchemaReady;
}
