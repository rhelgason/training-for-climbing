import { forward } from '../../../lib/server/proxy';

/** Proxy POST /api/coach → Railway /coach (bearer auth passed through). */
export function POST(req: Request) {
  return forward(req, '/coach');
}
