/**
 * GET /api/health — deployment smoke check.
 *
 * Mirrors the Express server's /health, plus a `db` field: the old server
 * connected to Postgres at boot and crashed if it couldn't, whereas a
 * serverless route only finds out at request time. Checking it here means a
 * bad DATABASE_URL shows up on this endpoint rather than as a 500 on sync.
 */
import { NextResponse } from 'next/server';
import { isAuthConfigured } from '../../../lib/server/auth';
import { isLlmConfigured } from '../../../lib/server/llm';
import { getPool } from '../../../lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let db = false;
  try {
    await getPool().query('SELECT 1');
    db = true;
  } catch (err) {
    console.error('GET /api/health: database unreachable', err);
  }
  return NextResponse.json({ ok: true, coach: isLlmConfigured(), auth: isAuthConfigured(), db });
}
