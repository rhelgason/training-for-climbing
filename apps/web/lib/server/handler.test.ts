/**
 * The auth gate every protected route sits behind. Worth pinning directly
 * rather than only through the routes: a regression here doesn't break one
 * endpoint, it either opens all of them or breaks all of them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { signToken } from './auth';
import { readJson, withUser } from './handler';

const SECRET = 'test-secret-not-a-real-one';

vi.mock('./db', () => ({ ensureSchema: vi.fn(async () => {}) }));

function request(headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request('https://example.test/api/snapshot', {
    method: 'POST',
    headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const ran = () => NextResponse.json({ ok: true });

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.SYNC_TOKEN;
  vi.restoreAllMocks();
});

describe('withUser', () => {
  it('runs the handler with the id from a valid token', async () => {
    const seen: string[] = [];
    const res = await withUser(
      request(bearer(signToken({ id: 'user-1', username: 'ryan' }))),
      'T',
      async (id) => {
        seen.push(id);
        return ran();
      },
    );
    expect(res.status).toBe(200);
    expect(seen).toEqual(['user-1']);
  });

  it('refuses without a token, and does not run the handler', async () => {
    let called = false;
    const res = await withUser(request(), 'T', async () => {
      called = true;
      return ran();
    });
    expect(res.status).toBe(401);
    expect(called).toBe(false);
  });

  it.each([
    ['garbage', 'not-a-jwt'],
    ['empty', ''],
  ])('refuses a %s token', async (_label, token) => {
    const res = await withUser(request(bearer(token)), 'T', async () => ran());
    expect(res.status).toBe(401);
  });

  it('refuses a token signed with a different secret', async () => {
    const token = signToken({ id: 'user-1', username: 'ryan' });
    process.env.JWT_SECRET = 'a-different-secret';
    const res = await withUser(request(bearer(token)), 'T', async () => ran());
    expect(res.status).toBe(401);
  });

  it('refuses the right token under the wrong scheme', async () => {
    const token = signToken({ id: 'user-1', username: 'ryan' });
    const res = await withUser(request({ authorization: `Basic ${token}` }), 'T', async () =>
      ran(),
    );
    expect(res.status).toBe(401);
  });

  it('reports a missing signing secret as 500, not 401', async () => {
    // A server misconfiguration must not read as "your credentials are wrong",
    // or the climber re-types a correct password until they give up.
    delete process.env.JWT_SECRET;
    const res = await withUser(request(bearer('anything')), 'T', async () => ran());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/JWT_SECRET/) });
  });

  it('maps a thrown handler to a 500 without leaking the message', async () => {
    const res = await withUser(
      request(bearer(signToken({ id: 'user-1', username: 'ryan' }))),
      'GET /api/thing',
      async () => {
        throw new Error('connection string is postgres://user:hunter2@host/db');
      },
    );
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('hunter2');
  });

  it('logs the failure with its route label, so 500s are traceable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await withUser(
      request(bearer(signToken({ id: 'user-1', username: 'ryan' }))),
      'GET /api/thing',
      async () => {
        throw new Error('boom');
      },
    );
    expect(spy).toHaveBeenCalledWith('GET /api/thing failed', expect.any(Error));
  });
});

describe('readJson', () => {
  it('parses a JSON body', async () => {
    expect(await readJson(request({}, { a: 1 }))).toEqual({ a: 1 });
  });

  it('returns null for malformed JSON rather than throwing', async () => {
    expect(await readJson(request({}, '{not json'))).toBeNull();
  });

  it('returns null for an absent body', async () => {
    expect(await readJson(request())).toBeNull();
  });
});
