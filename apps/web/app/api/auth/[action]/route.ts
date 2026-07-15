import { NextResponse } from 'next/server';
import { forward } from '../../../../lib/server/proxy';

/** Proxy POST /api/auth/{register,login} → Railway /auth/{register,login}. */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== 'register' && action !== 'login') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return forward(req, `/auth/${action}`);
}
