-- Schema for the sync backend (Neon Postgres).
--
-- The API routes apply this automatically on first request (see
-- apps/web/lib/server/db.ts), so you only need this file if you'd rather create
-- the tables up front — e.g. before importing data from the old Railway
-- database, where the tables must exist before a data-only restore.
--
--   psql "$NEON_DATABASE_URL" -f scripts/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One snapshot per user (FK to users; cascades on account deletion).
CREATE TABLE IF NOT EXISTS snapshots (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
