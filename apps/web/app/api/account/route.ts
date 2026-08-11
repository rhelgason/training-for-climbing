/**
 * DELETE /api/account — delete the signed-in account and all its data.
 *
 * Was a proxy to the Railway server's /account; now the implementation itself
 * (ported from `server/index.js`). The snapshot row cascades via its FK.
 */
import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/server/db';
import { withUser } from '../../../lib/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function DELETE(req: Request) {
  return withUser(req, 'DELETE /api/account', async (userId) => {
    await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
    return NextResponse.json({ ok: true });
  });
}
