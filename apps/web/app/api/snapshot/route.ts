import { forward } from '../../../lib/server/proxy';

/** Proxy GET/PUT /api/snapshot → Railway /snapshot (bearer auth passed through). */
export function GET(req: Request) {
  return forward(req, '/snapshot');
}

export function PUT(req: Request) {
  return forward(req, '/snapshot');
}
