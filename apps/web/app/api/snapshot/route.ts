/**
 * GET/PUT /api/snapshot — read and write the signed-in user's private snapshot.
 *
 * Was a proxy to the Railway server's /snapshot; now the implementation itself
 * (ported from `server/index.js`). One row per user, last write wins — the
 * merge happens client-side in the sync engine.
 */
import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/server/db';
import { readJson, withUser } from '../../../lib/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return withUser(req, 'GET /api/snapshot', async (userId) => {
    const { rows } = await getPool().query<{ data: unknown }>(
      'SELECT data FROM snapshots WHERE user_id = $1',
      [userId],
    );
    return NextResponse.json({ data: rows[0] ? rows[0].data : null });
  });
}

export function PUT(req: Request) {
  return withUser(req, 'PUT /api/snapshot', async (userId) => {
    const snapshot = await readJson<unknown>(req);
    if (snapshot === null || typeof snapshot !== 'object') {
      return NextResponse.json({ error: 'missing snapshot body' }, { status: 400 });
    }
    await getPool().query(
      `INSERT INTO snapshots (user_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [userId, snapshot],
    );
    return NextResponse.json({ ok: true });
  });
}
