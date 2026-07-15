/**
 * The signed-in account session, persisted in localStorage. Holds the JWT token
 * and the user's identity — the single source of truth for "am I signed in".
 * Cloud sync and the AI coach read the token from here.
 *
 * The API base is always the same-origin proxy (see lib/config), so the session
 * doesn't store a server URL the way the mobile app does.
 */
import { API_BASE } from '../config';
import type { SyncConfig } from '@tfc/core';

const KEY = 'tfc.auth';

export interface AuthSession {
  token: string;
  userId: string;
  email: string;
  /** Epoch ms of the last successful sync, if any. */
  lastSyncedAt?: number;
}

export function isSignedIn(session: AuthSession | null): session is AuthSession {
  return Boolean(session && session.token);
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

/** The current sync/coach config derived from the session, or null if signed out. */
export function getSyncConfig(): SyncConfig | null {
  const session = getSession();
  if (!isSignedIn(session)) return null;
  return { url: API_BASE, token: session.token, lastSyncedAt: session.lastSyncedAt };
}
