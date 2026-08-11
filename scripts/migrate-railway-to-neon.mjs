/**
 * One-shot data migration: Railway Postgres -> Neon Postgres.
 *
 * Copies the two tables the sync backend owns (users, snapshots). Safe to
 * re-run: existing rows are left alone, so a partial run can just be repeated.
 * Read-only against Railway — it only ever SELECTs.
 *
 * Uses the `pg` driver rather than pg_dump/psql on purpose. pg_dump refuses to
 * dump from a server newer than itself, so a local Postgres 14 client can't
 * touch a Postgres 16 Railway instance; the wire protocol has no such
 * restriction. The dataset here is a handful of rows, so streaming it through
 * Node costs nothing.
 *
 * Usage — both are the DIRECT connection strings (not Neon's "-pooler" host):
 *
 *   RAILWAY_DATABASE_URL='postgresql://...' \
 *   NEON_DATABASE_URL='postgresql://...' \
 *     node scripts/migrate-railway-to-neon.mjs
 *
 * Get RAILWAY_DATABASE_URL from the Railway Postgres plugin's Connect tab —
 * the public/external URL, not the internal one.
 */
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read explicitly rather than by computed key — eslint forbids process.env[name]. */
function required(name, value) {
  if (!value) {
    console.error(`Missing ${name}. See the usage comment at the top of this file.`);
    process.exit(1);
  }
  return value;
}

/**
 * Both ends need TLS; neither presents a cert chain we pin, so TLS comes from
 * the explicit `ssl` option. The connection string's own `sslmode` is dropped —
 * it would be redundant, and pg 8.x prints a deprecation warning about how it
 * intends to reinterpret those values in v9.
 */
function connect(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
}

/** Bytes of JSON in a snapshot — enough to tell real data from a stub. */
function approxSize(data) {
  const bytes = Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data ?? null));
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

async function main() {
  const railwayUrl = required('RAILWAY_DATABASE_URL', process.env.RAILWAY_DATABASE_URL);
  const neonUrl = required('NEON_DATABASE_URL', process.env.NEON_DATABASE_URL);

  const source = connect(railwayUrl);
  const target = connect(neonUrl);

  await source.connect();
  await target.connect();

  try {
    console.log('==> Creating the schema in Neon (idempotent)');
    await target.query(readFileSync(join(repoRoot, 'scripts', 'schema.sql'), 'utf8'));

    console.log('==> Reading users + snapshots from Railway');
    const { rows: users } = await source.query(
      'SELECT id, email, password_hash, created_at FROM users ORDER BY created_at',
    );
    const { rows: snapshots } = await source.query(
      'SELECT user_id, data, updated_at FROM snapshots',
    );
    console.log(`    ${users.length} user(s), ${snapshots.length} snapshot(s)`);

    // Users first — snapshots.user_id is a FK onto them.
    console.log('==> Writing to Neon');
    for (const u of users) {
      await target.query(
        `INSERT INTO users (id, email, password_hash, created_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.password_hash, u.created_at],
      );
    }
    // Railway's snapshots table predates accounts: it was created before the
    // users table existed, so `CREATE TABLE IF NOT EXISTS` never added the
    // foreign key and orphaned rows can survive there. Neon's schema does
    // enforce it, so partition rather than letting one bad row abort the run.
    const { rows: known } = await target.query('SELECT id FROM users');
    const knownIds = new Set(known.map((r) => r.id));
    const adoptable = snapshots.filter((s) => knownIds.has(s.user_id));
    const orphaned = snapshots.filter((s) => !knownIds.has(s.user_id));

    for (const s of adoptable) {
      await target.query(
        `INSERT INTO snapshots (user_id, data, updated_at)
         VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
        [s.user_id, s.data, s.updated_at],
      );
    }

    if (orphaned.length) {
      console.warn(
        `\n!!  Skipped ${orphaned.length} snapshot(s) with no matching user — most likely\n` +
          `    left over from the pre-accounts deployment, when snapshots were keyed by a\n` +
          `    shared token rather than a user id. Nothing was deleted on Railway.\n`,
      );
      for (const s of orphaned) {
        console.warn(
          `    user_id=${s.user_id}  updated=${new Date(s.updated_at).toISOString()}  ${approxSize(s.data)}`,
        );
      }
      console.warn(
        `\n    If one of these is real training data, the owner can sign in and re-sync from\n` +
          `    their device (the app is local-first, so their copy is authoritative). To adopt\n` +
          `    it instead, create the account first, then re-run with the row's user_id\n` +
          `    remapped. Re-running this script is safe.\n`,
      );
    }

    const { rows } = await target.query(
      'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM snapshots) AS snapshots',
    );
    console.log(`==> Neon now holds ${rows[0].users} user(s), ${rows[0].snapshots} snapshot(s)`);

    if (Number(rows[0].users) < users.length || Number(rows[0].snapshots) < adoptable.length) {
      console.error('Neon holds less than Railway did — investigate before cutting over.');
      process.exitCode = 1;
      return;
    }
    console.log('Done. Sign in on a preview deployment before deleting anything on Railway.');
  } finally {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
