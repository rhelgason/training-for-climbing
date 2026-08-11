/**
 * Shared plumbing for the authenticated API routes.
 *
 * Replaces the Express `auth` middleware from `server/index.js`: route handlers
 * have no middleware chain, so the same four steps (secret configured? → schema
 * ready → Bearer token valid? → run, mapping thrown errors to a 500) live here
 * and each handler wraps its body in `withUser`.
 */
import { NextResponse } from 'next/server';
import { isAuthConfigured, userIdFromRequest } from './auth';
import { ensureSchema } from './db';

/**
 * Run `fn` with the authenticated user's id, or short-circuit with the same
 * status codes the Express server returned: 500 when the server is missing its
 * signing secret, 401 for a missing/invalid token.
 *
 * `label` identifies the route in error logs (e.g. 'GET /api/snapshot').
 */
export async function withUser(
  req: Request,
  label: string,
  fn: (userId: string) => Promise<Response>,
): Promise<Response> {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: 'server is missing JWT_SECRET' }, { status: 500 });
  }
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    await ensureSchema();
    return await fn(userId);
  } catch (err) {
    console.error(`${label} failed`, err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

/** Parse a JSON body, returning null when it's absent or malformed. */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
