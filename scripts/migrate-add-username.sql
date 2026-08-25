-- One-shot migration: identify accounts by username, make email optional.
--
-- Accounts used to be keyed by email, but the address was never verified and
-- never sent to — it was a unique string with an @ in it. Username is what that
-- field actually was, so this renames the concept and demotes email to an
-- optional recovery address (nullable; UNIQUE still holds because Postgres
-- allows unlimited NULLs under a unique index).
--
-- Run this BEFORE deploying the code change. The new column is additive and
-- nullable, so the currently-deployed server (which selects by email) keeps
-- working in the gap; the reverse order breaks sign-in.
--
--   psql "$DATABASE_URL" -f scripts/migrate-add-username.sql
--
-- Set the username for the one existing account on the line below. Existing
-- session tokens are unaffected: authorization reads only the `sub` claim, so
-- nobody is signed out by this.

\set username 'ryan'

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Guard rather than half-migrate: this database is expected to hold exactly one
-- pre-username account. Anything else means the assumption is stale, and a bad
-- backfill here is not something a UNIQUE index will catch for us.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM users WHERE username IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 un-migrated account, found %', n;
  END IF;
END $$;

-- RETURNING prints the row so you can see which address the account was
-- registered with.
UPDATE users SET username = :'username' WHERE username IS NULL
  RETURNING id, username, email, created_at;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);

COMMIT;
