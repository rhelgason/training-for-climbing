/**
 * Tiny snapshot sync server for the Training for Climbing app.
 *
 * Stores one JSON snapshot per user in Postgres and exposes:
 *   GET  /health           → { ok: true }
 *   GET  /snapshot         → { data: Snapshot | null }   (auth)
 *   PUT  /snapshot  <json> → { ok: true }                (auth)
 *
 * Deploy to Railway alongside a Postgres plugin. Required env:
 *   DATABASE_URL  – provided by the Railway Postgres plugin
 *   SYNC_TOKEN    – a long random secret; the app must send it as a Bearer token
 *   PORT          – provided by Railway
 * Optional:
 *   PGSSL=disable – turn off TLS for local Postgres (Railway needs TLS, the default)
 */
const express = require('express');
const { Pool } = require('pg');

const TOKEN = process.env.SYNC_TOKEN;
// A shared-secret token gates a single snapshot (personal, multi-device use).
const USER_ID = 'default';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function auth(req, res, next) {
  if (!TOKEN) return res.status(500).json({ error: 'server is missing SYNC_TOKEN' });
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== TOKEN) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/snapshot', auth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT data FROM snapshots WHERE user_id = $1', [USER_ID]);
    res.json({ data: rows[0] ? rows[0].data : null });
  } catch (err) {
    console.error('GET /snapshot failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

app.put('/snapshot', auth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO snapshots (user_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [USER_ID, req.body],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /snapshot failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

const port = process.env.PORT || 3000;
ensureSchema()
  .then(() => app.listen(port, () => console.log(`sync server listening on ${port}`)))
  .catch((err) => {
    console.error('failed to start', err);
    process.exit(1);
  });
