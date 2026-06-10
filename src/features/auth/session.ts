/**
 * The signed-in account session, persisted locally. Holds the server URL, the
 * JWT session token, and the user's identity. This is the single source of truth
 * for "am I signed in / where do I sync" — cloud sync and the AI coach both read
 * the token from here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tfc.auth';

export interface AuthSession {
  /** Sync server base URL. */
  url: string;
  /** JWT bearer token issued at register/login. */
  token: string;
  userId: string;
  email: string;
  /** Epoch ms of the last successful sync, if any. */
  lastSyncedAt?: number;
}

export function isSignedIn(session: AuthSession | null): session is AuthSession {
  return Boolean(session && session.url && session.token);
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
