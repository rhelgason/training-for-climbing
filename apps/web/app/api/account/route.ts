import { forward } from '../../../lib/server/proxy';

/** Proxy DELETE /api/account → Railway /account (bearer auth passed through). */
export function DELETE(req: Request) {
  return forward(req, '/account');
}
