import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  getSession,
  getSyncConfig,
  isSignedIn,
  saveSession,
  type AuthSession,
} from './session';

const sample: AuthSession = {
  token: 'jwt-token-123',
  userId: 'user-1',
  email: 'climber@example.com',
  lastSyncedAt: 1700000000000,
};

describe('auth session', () => {
  afterEach(() => {
    clearSession();
  });

  it('round-trips a saved session through localStorage', () => {
    expect(getSession()).toBeNull();
    saveSession(sample);
    expect(getSession()).toEqual(sample);
  });

  it('clearSession removes the persisted session', () => {
    saveSession(sample);
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('isSignedIn reflects the presence of a token', () => {
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn({ ...sample, token: '' })).toBe(false);
    expect(isSignedIn(sample)).toBe(true);
  });

  it('getSyncConfig returns null when signed out', () => {
    expect(getSyncConfig()).toBeNull();
  });

  it('getSyncConfig returns the /api url and token when signed in', () => {
    saveSession(sample);
    expect(getSyncConfig()).toEqual({
      url: '/api',
      token: sample.token,
      lastSyncedAt: sample.lastSyncedAt,
    });
  });
});
