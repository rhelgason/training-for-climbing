#!/usr/bin/env bash
#
# One-shot data migration: Railway Postgres -> Neon Postgres.
#
# Copies the two tables the sync backend owns (users, snapshots). Safe to re-run:
# rows that already exist in Neon are skipped, so a partial run can be repeated.
# Read-only against Railway — it only ever dumps.
#
# Usage:
#   RAILWAY_DATABASE_URL='postgresql://...' \
#   NEON_DATABASE_URL='postgresql://...' \
#     ./scripts/migrate-railway-to-neon.sh
#
# Get RAILWAY_DATABASE_URL from the Railway Postgres plugin's Connect tab
# (the public/external URL, not the internal one). Use Neon's DIRECT connection
# string here, not the pooled "-pooler" host — pg_restore-style bulk loads want a
# real session.
#
# Requires psql and pg_dump (Postgres 16+ client: `brew install libpq`).

set -euo pipefail

: "${RAILWAY_DATABASE_URL:?set RAILWAY_DATABASE_URL to the Railway Postgres connection string}"
: "${NEON_DATABASE_URL:?set NEON_DATABASE_URL to the Neon connection string}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dump_file="$(mktemp -t tfc-railway-dump)"
trap 'rm -f "$dump_file"' EXIT

echo "==> Creating the schema in Neon (idempotent)"
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$repo_root/scripts/schema.sql"

echo "==> Dumping users + snapshots from Railway"
pg_dump "$RAILWAY_DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=public.users \
  --table=public.snapshots \
  --column-inserts \
  --on-conflict-do-nothing \
  --file="$dump_file"

rows=$(grep -c '^INSERT INTO' "$dump_file" || true)
echo "    $rows row(s) to import"

echo "==> Importing into Neon"
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$dump_file"

echo "==> Verifying"
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM snapshots) AS snapshots;"

echo "Done. Sign in on a preview deployment before deleting anything on Railway."
