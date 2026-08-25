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
  username: string;
  /** Optional recovery address; null/absent when the account has none. */
  email?: string | null;
  /** Epoch ms of the last successful sync, if any. */
  lastSyncedAt?: number;
}

/**
 * Sessions stored before accounts moved to usernames hold `email` and no
 * `username`. The token is still valid (authorization is by `sub`), so rather
 * than signing the user out we show the address they signed in with until they
 * next sign in and we learn the real username.
 */
function withUsername(session: AuthSession): AuthSession {
  if (session.username) return session;
  return { ...session, username: session.email ?? '' };
}

export function isSignedIn(session: AuthSession | null): session is AuthSession {
  return Boolean(session && session.url && session.token);
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return withUsername(JSON.parse(raw) as AuthSession);
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
