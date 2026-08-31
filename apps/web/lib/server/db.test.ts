/**
 * `ensureSchema` is memoised per warm serverless instance, and deliberately
 * does *not* cache a rejection. That second part is the one worth pinning: a
 * cold start racing Neon waking from scale-to-zero fails once, and if the
 * failure stuck, that instance would refuse every request for its whole life
 * rather than for one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('pg', () => ({ Pool: vi.fn(() => ({ query })) }));

type Global = typeof globalThis & {
  __tfcPool?: unknown;
  __tfcSchemaReady?: Promise<void>;
};

async function freshModule() {
  // The memo lives on globalThis so hot reloads don't leak pools; clear both it
  // and the module registry so each case starts cold.
  const g = globalThis as Global;
  delete g.__tfcPool;
  delete g.__tfcSchemaReady;
  vi.resetModules();
  return import('./db');
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://user:pw@host/db';
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.restoreAllMocks();
});

describe('getPool', () => {
  it('refuses to invent a connection when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    const { getPool } = await freshModule();
    expect(() => getPool()).toThrow(/DATABASE_URL/);
  });

  it('reuses one pool across calls, so warm invocations do not open more', async () => {
    const { getPool } = await freshModule();
    expect(getPool()).toBe(getPool());
  });
});

describe('ensureSchema', () => {
  it('creates both tables', async () => {
    const { ensureSchema } = await freshModule();
    await ensureSchema();
    const sql = query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS snapshots/);
  });

  it('creates the fresh-install shape: username required, email optional', async () => {
    const { ensureSchema } = await freshModule();
    await ensureSchema();
    const users = query.mock.calls.map((c) => String(c[0])).find((s) => s.includes('users'))!;
    expect(users).toMatch(/username TEXT UNIQUE NOT NULL/);
    expect(users).toMatch(/email TEXT UNIQUE(?!\s+NOT NULL)/);
  });

  it('runs once however many times it is awaited', async () => {
    const { ensureSchema } = await freshModule();
    await Promise.all([ensureSchema(), ensureSchema(), ensureSchema()]);
    await ensureSchema();
    expect(query).toHaveBeenCalledTimes(2); // the two CREATE TABLEs, once
  });

  it('does not cache a failure — the next request retries', async () => {
    const { ensureSchema } = await freshModule();
    query.mockRejectedValueOnce(new Error('the database is waking up'));

    await expect(ensureSchema()).rejects.toThrow(/waking up/);

    query.mockResolvedValue({ rows: [] });
    await expect(ensureSchema()).resolves.toBeUndefined();
  });

  it('stays failed-then-recovered rather than wedging the instance', async () => {
    const { ensureSchema } = await freshModule();
    query.mockRejectedValue(new Error('still down'));
    await expect(ensureSchema()).rejects.toThrow();
    await expect(ensureSchema()).rejects.toThrow();

    query.mockReset();
    query.mockResolvedValue({ rows: [] });
    await expect(ensureSchema()).resolves.toBeUndefined();
  });
});
