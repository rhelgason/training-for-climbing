/**
 * POST /api/auth/{register,login} — create a session.
 *
 * Was a proxy to the Railway server's /auth/{register,login}; now the
 * implementation itself (ported from `server/index.js`). The signing secret is
 * unchanged, so tokens and password hashes from the old deployment stay valid.
 */
import { NextResponse } from 'next/server';
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  isAuthConfigured,
  isValidEmail,
  isValidPassword,
  newUserId,
  normalizeEmail,
  signToken,
  verifyPassword,
} from '../../../../lib/server/auth';
import { ensureSchema, getPool } from '../../../../lib/server/db';
import { readJson } from '../../../../lib/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Credentials {
  email?: unknown;
  password?: unknown;
}

/** Postgres unique-violation — a second account with the same email. */
const UNIQUE_VIOLATION = '23505';

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== 'register' && action !== 'login') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: 'server is missing JWT_SECRET' }, { status: 500 });
  }

  const body = (await readJson<Credentials>(req)) ?? {};
  const email = normalizeEmail(body.email);
  const { password } = body;

  try {
    await ensureSchema();
    return action === 'register' ? await register(email, password) : await login(email, password);
  } catch (err) {
    if (action === 'register' && (err as { code?: string })?.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: 'an account with that email already exists' },
        { status: 409 },
      );
    }
    console.error(`POST /api/auth/${action} failed`, err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

async function register(email: string, password: unknown): Promise<Response> {
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'enter a valid email' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }
  const id = newUserId();
  const passwordHash = await hashPassword(password);
  await getPool().query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [
    id,
    email,
    passwordHash,
  ]);
  const user = { id, email };
  return NextResponse.json({ token: signToken(user), user });
}

async function login(email: string, password: unknown): Promise<Response> {
  const { rows } = await getPool().query<{ id: string; email: string; password_hash: string }>(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email],
  );
  const row = rows[0];
  const ok =
    row && typeof password === 'string' && (await verifyPassword(password, row.password_hash));
  if (!ok) {
    return NextResponse.json({ error: 'incorrect email or password' }, { status: 401 });
  }
  const user = { id: row.id, email: row.email };
  return NextResponse.json({ token: signToken(user), user });
}
