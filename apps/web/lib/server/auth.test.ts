import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  isAuthConfigured,
  isValidEmail,
  isValidPassword,
  newUserId,
  normalizeEmail,
  signToken,
  userIdFromRequest,
  verifyPassword,
  verifyToken,
} from './auth';

const SECRET = 'test-secret-not-a-real-one';

function bearer(token: string): Request {
  return new Request('https://example.test/api/snapshot', {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.SYNC_TOKEN;
});

describe('isAuthConfigured', () => {
  it('is false with no secret, true with either variable', () => {
    delete process.env.JWT_SECRET;
    expect(isAuthConfigured()).toBe(false);

    // SYNC_TOKEN is the legacy name, still honoured for older deployments.
    process.env.SYNC_TOKEN = SECRET;
    expect(isAuthConfigured()).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Climber@Example.COM ')).toBe('climber@example.com');
  });

  it('turns nullish input into an empty string rather than throwing', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('isValidEmail', () => {
  it.each(['a@b.co', 'climber@example.com'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'no-at-sign', 'no@domain', 'two@@at.com', 'spaces @example.com'])(
    'rejects %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe('isValidPassword', () => {
  it('requires the minimum length', () => {
    expect(isValidPassword('x'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPassword('x'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it('rejects non-strings', () => {
    expect(isValidPassword(12345678)).toBe(false);
    expect(isValidPassword(null)).toBe(false);
  });
});

describe('password hashing', () => {
  it('round-trips the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toContain('correct horse battery');
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong horse battery', hash)).resolves.toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips the user id and email', () => {
    const token = signToken({ id: 'user-1', email: 'climber@example.com' });
    const payload = verifyToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.email).toBe('climber@example.com');
  });

  it('rejects a missing, malformed, or wrongly-signed token', () => {
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('not-a-jwt')).toBeNull();

    const token = signToken({ id: 'user-1', email: 'climber@example.com' });
    process.env.JWT_SECRET = 'a-different-secret';
    expect(verifyToken(token)).toBeNull();
  });
});

describe('userIdFromRequest', () => {
  it('resolves a valid Bearer token to the user id', () => {
    const token = signToken({ id: 'user-1', email: 'climber@example.com' });
    expect(userIdFromRequest(bearer(token))).toBe('user-1');
  });

  it('returns null without a usable Bearer token', () => {
    const noHeader = new Request('https://example.test/api/snapshot');
    expect(userIdFromRequest(noHeader)).toBeNull();
    expect(userIdFromRequest(bearer('garbage'))).toBeNull();

    // Right token, wrong scheme.
    const token = signToken({ id: 'user-1', email: 'climber@example.com' });
    const basic = new Request('https://example.test/api/snapshot', {
      headers: { authorization: `Basic ${token}` },
    });
    expect(userIdFromRequest(basic)).toBeNull();
  });
});

describe('newUserId', () => {
  it('generates distinct ids', () => {
    expect(newUserId()).not.toBe(newUserId());
  });
});
