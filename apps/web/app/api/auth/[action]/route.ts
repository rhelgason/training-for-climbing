/**
 * POST /api/auth/{register,login} — create a session.
 *
 * Was a proxy to the Railway server's /auth/{register,login}; now the
 * implementation itself (ported from `server/index.js`). The signing secret is
 * unchanged, so tokens and password hashes from the old deployment stay valid.
 *
 * Accounts are identified by username. Email is optional and exists only so an
 * account can be recovered later — it is never verified and never sent to, so
 * treat it as a hint the user chose to leave, not as a reachable address.
 */
import { NextResponse } from 'next/server';
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  isAuthConfigured,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  newUserId,
  normalizeOptionalEmail,
  normalizeUsername,
  signToken,
  verifyPassword,
} from '../../../../lib/server/auth';
import { ensureSchema, getPool } from '../../../../lib/server/db';
import { readJson } from '../../../../lib/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Credentials {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

/** Postgres unique-violation — a second account with the same username/email. */
const UNIQUE_VIOLATION = '23505';

interface UserRow {
  id: string;
  username: string;
  email: string | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== 'register' && action !== 'login') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: 'server is missing JWT_SECRET' }, { status: 500 });
  }

  const body = (await readJson<Credentials>(req)) ?? {};
  const { password } = body;

  try {
    await ensureSchema();
    return action === 'register' ? await register(body, password) : await login(body, password);
  } catch (err) {
    if (action === 'register' && (err as { code?: string })?.code === UNIQUE_VIOLATION) {
      // Both username and email are unique; say which one collided rather than
      // making the user guess why an address-less sign-up was rejected.
      const field = /email/.test(String((err as { constraint?: string })?.constraint ?? ''))
        ? 'email'
        : 'username';
      return NextResponse.json({ error: `that ${field} is already taken` }, { status: 409 });
    }
    console.error(`POST /api/auth/${action} failed`, err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

async function register(body: Credentials, password: unknown): Promise<Response> {
  const username = normalizeUsername(body.username);
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: 'username must be 3-30 characters: letters, numbers, - or _' },
      { status: 400 },
    );
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }
  // Optional: absent is fine, but a present-and-malformed address is a typo
  // worth catching now, since it's the only route back into a locked account.
  const email = normalizeOptionalEmail(body.email);
  if (email !== null && !isValidEmail(email)) {
    return NextResponse.json({ error: 'enter a valid email, or leave it blank' }, { status: 400 });
  }

  const id = newUserId();
  const passwordHash = await hashPassword(password);
  await getPool().query(
    'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
    [id, username, email, passwordHash],
  );
  const user = { id, username, email };
  return NextResponse.json({ token: signToken({ id, username }), user });
}

async function login(body: Credentials, password: unknown): Promise<Response> {
  // Accept either identifier. Usernames can't contain '@', so the two namespaces
  // are disjoint and the OR can't match the wrong row — and it keeps app builds
  // that still post `email` working until they're rebuilt.
  const identifier = normalizeUsername(body.username ?? body.email);
  const { rows } = await getPool().query<UserRow & { password_hash: string }>(
    'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
    [identifier],
  );
  const row = rows[0];
  const ok =
    row && typeof password === 'string' && (await verifyPassword(password, row.password_hash));
  if (!ok) {
    return NextResponse.json({ error: 'incorrect username or password' }, { status: 401 });
  }
  const user = { id: row.id, username: row.username, email: row.email };
  return NextResponse.json({ token: signToken({ id: row.id, username: row.username }), user });
}
