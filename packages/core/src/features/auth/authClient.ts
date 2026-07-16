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

/**
 * Step 1 of password reset: ask the server to email a short-lived reset code.
 * Resolves whether or not the email exists (the server doesn't reveal that);
 * throws only on a real failure (e.g. email not configured, send failed).
 */
export async function requestPasswordReset(baseUrl: string, email: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint(baseUrl, '/auth/request-reset'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
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

/**
 * Step 2 of password reset: verify the emailed code and set a new password.
 * Returns a fresh session token so the user is signed straight in.
 */
export function resetPassword(
  baseUrl: string,
  email: string,
  code: string,
  newPassword: string,
): Promise<AuthResult> {
  return post(endpoint(baseUrl, '/auth/reset'), { email, code, newPassword });
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
