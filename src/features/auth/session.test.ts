import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSession, getSession, isSignedIn, saveSession, type AuthSession } from './session';

const session: AuthSession = {
  url: 'https://srv.example.com',
  token: 'jwt-abc',
  userId: 'u1',
  username: 'climber',
  email: 'a@b.com',
};

describe('session', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('isSignedIn requires both a url and a token', () => {
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn({ ...session, token: '' })).toBe(false);
    expect(isSignedIn({ ...session, url: '' })).toBe(false);
    expect(isSignedIn(session)).toBe(true);
  });

  it('round-trips a saved session and clears it', async () => {
    expect(await getSession()).toBeNull();
    await saveSession(session);
    expect(await getSession()).toEqual(session);
    await clearSession();
    expect(await getSession()).toBeNull();
  });

  it('round-trips a session that has no recovery email', async () => {
    const { email: _email, ...noEmail } = session;
    await saveSession(noEmail);
    expect(await getSession()).toEqual(noEmail);
  });

  it('falls back to the stored email for a session saved before usernames', async () => {
    // The token is still valid, so signing this user out would be gratuitous —
    // show the address they signed in with until they next sign in.
    await AsyncStorage.setItem(
      'tfc.auth',
      JSON.stringify({ url: session.url, token: 'jwt-abc', userId: 'u1', email: 'a@b.com' }),
    );
    expect((await getSession())?.username).toBe('a@b.com');
  });

  it('returns null on corrupt JSON', async () => {
    await AsyncStorage.setItem('tfc.auth', 'not json');
    expect(await getSession()).toBeNull();
  });
});
