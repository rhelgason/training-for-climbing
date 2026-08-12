/**
 * Auth client — talks to the server's /auth endpoints. Returns a session token
 * and the user's identity; the caller persists them via the session store.
 */

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

/** Thrown on any auth failure, carrying a user-facing message + HTTP status. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * True when an error means the stored session token is no longer accepted —
 * it expired, or the server's signing secret was rotated. Callers should clear
 * the session and prompt a fresh sign-in rather than showing a generic failure,
 * since retrying can never succeed.
 */
export function isSessionExpired(err: unknown): boolean {
  return err instanceof AuthError && err.status === 401;
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

async function post(url: string, body: unknown): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AuthError(`Couldn't reach the server: ${(err as Error).message}`);
  }

  let payload: { token?: string; user?: { id: string; email: string }; error?: string } = {};
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    // fall through to the status-based message below
  }

  if (!res.ok || !payload.token || !payload.user) {
    throw new AuthError(payload.error || `Request failed (HTTP ${res.status})`, res.status);
  }
  return { token: payload.token, user: payload.user };
}

export function register(baseUrl: string, email: string, password: string): Promise<AuthResult> {
  return post(endpoint(baseUrl, '/auth/register'), { email, password });
}

export function login(baseUrl: string, email: string, password: string): Promise<AuthResult> {
  return post(endpoint(baseUrl, '/auth/login'), { email, password });
}

/** Permanently delete the signed-in account and its server-side data. */
export async function deleteAccount(baseUrl: string, token: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint(baseUrl, '/account'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new AuthError(`Couldn't reach the server: ${(err as Error).message}`);
  }
  if (!res.ok) {
    let payload: { error?: string } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      // fall through
    }
    throw new AuthError(payload.error || `Request failed (HTTP ${res.status})`, res.status);
  }
}
