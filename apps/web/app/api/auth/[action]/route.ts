import { NextResponse } from 'next/server';
import { forward } from '../../../../lib/server/proxy';

/** Proxy POST /api/auth/{register,login} → Railway /auth/{register,login}. */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const ALLOWED = ['register', 'login', 'request-reset', 'reset'];
  const { action } = await params;
  if (!ALLOWED.includes(action)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return forward(req, `/auth/${action}`);
}
