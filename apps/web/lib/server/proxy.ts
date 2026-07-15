/**
 * Server-only helper: forward a request to the Railway backend. Keeps the
 * backend URL server-side (never shipped to the browser) and passes through the
 * caller's Authorization header + JSON body. This is why the web app needs no
 * CORS on the server — every backend call is same-origin under /api.
 */
import { NextResponse } from 'next/server';

function railwayBase(): string {
  const base = process.env.RAILWAY_API_URL;
  if (!base) throw new Error('RAILWAY_API_URL is not configured');
  return base.replace(/\/+$/, '');
}

/**
 * Proxy `req` to `${RAILWAY_API_URL}${path}` and return the upstream response
 * verbatim (status + JSON body). `path` must start with '/'.
 */
export async function forward(req: Request, path: string): Promise<Response> {
  let base: string;
  try {
    base = railwayBase();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const method = req.method.toUpperCase();
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers.Authorization = auth;

  const hasBody = method !== 'GET' && method !== 'HEAD';
  let body: string | undefined;
  if (hasBody) {
    body = await req.text();
    if (body) headers['Content-Type'] = 'application/json';
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${path}`, { method, headers, body });
  } catch (err) {
    return NextResponse.json(
      { error: `Couldn't reach the server: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Pass the upstream status + body straight through.
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
