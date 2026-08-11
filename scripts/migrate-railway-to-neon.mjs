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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See the usage comment at the top of this file.`);
    process.exit(1);
  }
  return value;
}

/** Both ends need TLS; neither presents a cert chain we pin. */
function connect(connectionString) {
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

async function main() {
  const railwayUrl = required('RAILWAY_DATABASE_URL');
  const neonUrl = required('NEON_DATABASE_URL');

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
    for (const s of snapshots) {
      await target.query(
        `INSERT INTO snapshots (user_id, data, updated_at)
         VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
        [s.user_id, s.data, s.updated_at],
      );
    }

    const { rows } = await target.query(
      'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM snapshots) AS snapshots',
    );
    console.log(`==> Neon now holds ${rows[0].users} user(s), ${rows[0].snapshots} snapshot(s)`);

    if (Number(rows[0].users) < users.length) {
      console.error('Fewer users in Neon than in Railway — investigate before cutting over.');
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
