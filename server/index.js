/**
 * Sync + AI server for the Training for Climbing app.
 *
 * Each account has its own private snapshot. Endpoints:
 *   GET  /health             → { ok: true, coach: boolean }
 *   POST /auth/register      → { token, user }                    (email + password)
 *   POST /auth/login         → { token, user }                    (email + password)
 *   GET    /snapshot         → { data: Snapshot | null }          (auth)
 *   PUT    /snapshot <json>  → { ok: true }                       (auth)
 *   DELETE /account          → { ok: true }                       (auth)
 *   POST   /coach    <json>  → { suggestion: CoachSuggestion }    (auth, AI)
 *
 * Auth is a JWT session token (Bearer) issued at register/login.
 *
 * Deploy to Railway alongside a Postgres plugin. Required env:
 *   DATABASE_URL  – provided by the Railway Postgres plugin
 *   JWT_SECRET    – secret for signing session tokens (falls back to SYNC_TOKEN)
 *   PORT          – provided by Railway
 * Optional:
 *   PGSSL=disable    – turn off TLS for local Postgres (Railway needs TLS, the default)
 *   GEMINI_API_KEY   – free LLM key enabling the AI coach (see llm.js / README)
 *   LLM_PROVIDER     – 'gemini' (default) | 'groq'
 */
const express = require('express');
const { Pool } = require('pg');
const { generateCoachSuggestion, isLlmConfigured } = require('./llm');
const {
  isAuthConfigured,
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  newUserId,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  MIN_PASSWORD_LENGTH,
} = require('./auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Recovery code (bcrypt hash) for password reset without email. Added via
  // ALTER so existing deployments upgrade in place.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT`);
  // One snapshot per user (FK to users; cascades on account deletion).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

// Verify the Bearer session token and attach the user id to the request.
function auth(req, res, next) {
  if (!isAuthConfigured()) return res.status(500).json({ error: 'server is missing JWT_SECRET' });
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.userId = payload.sub;
  return next();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) =>
  res.json({ ok: true, coach: isLlmConfigured(), auth: isAuthConfigured() }),
);

app.post('/auth/register', async (req, res) => {
  if (!isAuthConfigured()) return res.status(500).json({ error: 'server is missing JWT_SECRET' });
  const email = normalizeEmail(req.body && req.body.email);
  const password = req.body && req.body.password;
  if (!isValidEmail(email)) return res.status(400).json({ error: 'enter a valid email' });
  if (!isValidPassword(password)) {
    return res
      .status(400)
      .json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  try {
    const id = newUserId();
    const passwordHash = await hashPassword(password);
    const recoveryCode = generateRecoveryCode();
    const recoveryHash = await hashRecoveryCode(recoveryCode);
    await pool.query(
      'INSERT INTO users (id, email, password_hash, recovery_code_hash) VALUES ($1, $2, $3, $4)',
      [id, email, passwordHash, recoveryHash],
    );
    const user = { id, email };
    // recoveryCode is returned exactly once — the client must show it to the user.
    res.json({ token: signToken(user), user, recoveryCode });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'an account with that email already exists' });
    }
    console.error('POST /auth/register failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

app.post('/auth/reset', async (req, res) => {
  if (!isAuthConfigured()) return res.status(500).json({ error: 'server is missing JWT_SECRET' });
  const email = normalizeEmail(req.body && req.body.email);
  const recoveryCode = req.body && req.body.recoveryCode;
  const newPassword = req.body && req.body.newPassword;
  if (!isValidPassword(newPassword)) {
    return res
      .status(400)
      .json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, email, recovery_code_hash FROM users WHERE email = $1',
      [email],
    );
    const row = rows[0];
    const ok = row && (await verifyRecoveryCode(recoveryCode || '', row.recovery_code_hash));
    if (!ok) return res.status(401).json({ error: 'incorrect email or recovery code' });
    // Rotate both the password and the recovery code (single-use).
    const passwordHash = await hashPassword(newPassword);
    const nextCode = generateRecoveryCode();
    const nextHash = await hashRecoveryCode(nextCode);
    await pool.query('UPDATE users SET password_hash = $1, recovery_code_hash = $2 WHERE id = $3', [
      passwordHash,
      nextHash,
      row.id,
    ]);
    const user = { id: row.id, email: row.email };
    res.json({ token: signToken(user), user, recoveryCode: nextCode });
  } catch (err) {
    console.error('POST /auth/reset failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

app.post('/auth/login', async (req, res) => {
  if (!isAuthConfigured()) return res.status(500).json({ error: 'server is missing JWT_SECRET' });
  const email = normalizeEmail(req.body && req.body.email);
  const password = req.body && req.body.password;
  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    const row = rows[0];
    const ok = row && (await verifyPassword(password || '', row.password_hash));
    if (!ok) return res.status(401).json({ error: 'incorrect email or password' });
    const user = { id: row.id, email: row.email };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('POST /auth/login failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

app.get('/snapshot', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT data FROM snapshots WHERE user_id = $1', [
      req.userId,
    ]);
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
      [req.userId, req.body],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /snapshot failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Delete the signed-in account and all its data (snapshot cascades via FK).
app.delete('/account', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /account failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// AI coach: the app sends its training context; we call the LLM and return a
// structured suggestion. When no LLM key is configured we return 503 so the app
// falls back to its deterministic baseline.
app.post('/coach', auth, async (req, res) => {
  if (!isLlmConfigured()) {
    return res.status(503).json({ error: 'AI coach not configured' });
  }
  const context = req.body && req.body.context;
  if (!context || typeof context !== 'object') {
    return res.status(400).json({ error: 'missing context' });
  }
  try {
    const suggestion = await generateCoachSuggestion(context);
    res.json({ suggestion });
  } catch (err) {
    console.error('POST /coach failed', err);
    res.status(502).json({ error: 'coach upstream error' });
  }
});

const port = process.env.PORT || 3000;
ensureSchema()
  .then(() => app.listen(port, () => console.log(`sync server listening on ${port}`)))
  .catch((err) => {
    console.error('failed to start', err);
    process.exit(1);
  });
