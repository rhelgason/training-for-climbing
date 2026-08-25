import { AuthError, deleteAccount, login, register } from './authClient';

const result = { token: 'jwt-abc', user: { id: 'u1', username: 'climber', email: 'a@b.com' } };

function mockFetch(impl: typeof fetch) {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = impl;
}

describe('authClient', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  });

  it('register posts to /auth/register and returns the token + user', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    mockFetch((async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => result } as Response;
    }) as unknown as typeof fetch);

    const out = await register('https://srv.example.com/', 'climber', 'password123', 'a@b.com');

    expect(out).toEqual(result);
    expect(calls[0].url).toBe('https://srv.example.com/auth/register');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      username: 'climber',
      password: 'password123',
      email: 'a@b.com',
    });
  });

  it('register omits email entirely when none is given', async () => {
    const calls: { init: RequestInit }[] = [];
    mockFetch((async (url: string, init: RequestInit) => {
      calls.push({ init });
      return { ok: true, status: 200, json: async () => result } as Response;
    }) as unknown as typeof fetch);

    await register('https://srv.example.com', 'climber', 'password123');

    // Absent, not '' — the server maps a blank address to NULL, and sending the
    // key at all invites a 400 for a malformed address the user never typed.
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      username: 'climber',
      password: 'password123',
    });
  });

  it('register treats a whitespace-only email as no email', async () => {
    const calls: { init: RequestInit }[] = [];
    mockFetch((async (url: string, init: RequestInit) => {
      calls.push({ init });
      return { ok: true, status: 200, json: async () => result } as Response;
    }) as unknown as typeof fetch);

    await register('https://srv.example.com', 'climber', 'password123', '   ');

    expect(JSON.parse(calls[0].init.body as string)).not.toHaveProperty('email');
  });

  it('login posts to /auth/login', async () => {
    const calls: { url: string }[] = [];
    mockFetch((async (url: string) => {
      calls.push({ url });
      return { ok: true, status: 200, json: async () => result } as Response;
    }) as unknown as typeof fetch);

    await login('https://srv.example.com', 'climber', 'password123');
    expect(calls[0].url).toBe('https://srv.example.com/auth/login');
  });

  it('throws AuthError with the server message + status on failure', async () => {
    mockFetch(
      (async () =>
        ({
          ok: false,
          status: 409,
          json: async () => ({ error: 'that username is already taken' }),
        }) as Response) as unknown as typeof fetch,
    );

    await expect(
      register('https://srv.example.com', 'climber', 'password123'),
    ).rejects.toMatchObject({ name: 'AuthError', status: 409, message: /already taken/ });
  });

  it('throws AuthError when the network call fails', async () => {
    mockFetch((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    await expect(login('https://srv.example.com', 'climber', 'pw')).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it('deleteAccount sends a DELETE to /account with the bearer token', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    mockFetch((async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch);

    await deleteAccount('https://srv.example.com', 'jwt-abc');
    expect(calls[0].url).toBe('https://srv.example.com/account');
    expect(calls[0].init.method).toBe('DELETE');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
  });

  it('deleteAccount throws AuthError on a non-OK response', async () => {
    mockFetch(
      (async () =>
        ({
          ok: false,
          status: 401,
          json: async () => ({ error: 'unauthorized' }),
        }) as Response) as unknown as typeof fetch,
    );
    await expect(deleteAccount('https://srv.example.com', 'bad')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws AuthError on a malformed (token-less) success response', async () => {
    mockFetch(
      (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ user: result.user }),
        }) as Response) as unknown as typeof fetch,
    );
    await expect(login('https://srv.example.com', 'climber', 'pw')).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});
