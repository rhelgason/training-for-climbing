'use client';

import { useEffect, useState } from 'react';
import {
  AuthError,
  HttpRemoteStore,
  deleteAccount,
  isSessionExpired,
  log,
  login,
  now,
  register,
  runSync,
  trackEvent,
} from '@tfc/core';
import { Button } from './Button';
import { Card } from './Card';
import { useRepository } from '../lib/db/RepositoryProvider';
import { API_BASE } from '../lib/config';
import { clearSession, getSession, saveSession, type AuthSession } from '../lib/auth/session';
import { clearCachedSuggestion } from '../lib/coach/cache';

type Mode = 'login' | 'register';

const inputClass =
  'w-full rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none';

export function AccountSettings() {
  const repo = useRepository();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
    setReady(true);
  }, []);

  const doSync = async (s: AuthSession): Promise<number> => {
    await runSync(repo, new HttpRemoteStore(API_BASE, s.token));
    const syncedAt = now();
    saveSession({ ...s, lastSyncedAt: syncedAt });
    trackEvent('cloud_synced');
    return syncedAt;
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      window.alert('Enter your email and password.');
      return;
    }
    setBusy(true);
    setStatus(mode === 'register' ? 'Creating account…' : 'Signing in…');
    try {
      const result =
        mode === 'register'
          ? await register(API_BASE, email.trim(), password)
          : await login(API_BASE, email.trim(), password);
      const next: AuthSession = {
        token: result.token,
        userId: result.user.id,
        email: result.user.email,
      };
      saveSession(next);
      trackEvent(mode === 'register' ? 'signed_up' : 'signed_in');
      setStatus('Syncing…');
      const syncedAt = await doSync(next);
      setSession({ ...next, lastSyncedAt: syncedAt });
      setPassword('');
      setStatus('Synced');
    } catch (err) {
      const message =
        err instanceof AuthError ? err.message : String((err as Error).message ?? err);
      log.error('auth failed', err);
      setStatus(null);
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    if (!session) return;
    setBusy(true);
    setStatus('Syncing…');
    try {
      const syncedAt = await doSync(session);
      setSession({ ...session, lastSyncedAt: syncedAt });
      setStatus('Synced');
    } catch (err) {
      // A rejected token can't be retried into working — drop back to the
      // sign-in form rather than leaving a dead session in place.
      if (isSessionExpired(err)) {
        log.warn('session expired during manual sync; signing out');
        signOut();
        window.alert('Your session has expired. Please sign in again.');
        return;
      }
      log.error('sync failed', err);
      setStatus('Sync failed');
      window.alert(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    clearSession();
    clearCachedSuggestion();
    trackEvent('signed_out');
    setSession(null);
    setStatus(null);
    setEmail('');
    setPassword('');
  };

  const removeAccount = async () => {
    if (!session) return;
    setBusy(true);
    setStatus('Deleting account…');
    try {
      await deleteAccount(API_BASE, session.token);
      clearSession();
      clearCachedSuggestion();
      trackEvent('account_deleted');
      setSession(null);
      setStatus(null);
      setEmail('');
      setPassword('');
    } catch (err) {
      log.error('delete account failed', err);
      setStatus(null);
      window.alert(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (
      window.confirm(
        'Delete account? This permanently deletes your account and its cloud backup. Your data on this device is kept, but it will no longer sync.',
      )
    ) {
      void removeAccount();
    }
  };

  if (!ready) return null;

  // ── Signed in ──────────────────────────────────────────────────────────
  if (session) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="display text-xl font-bold">Account</h2>
        <Card>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="text-lg font-semibold">{session.email}</p>
          {session.lastSyncedAt ? (
            <p className="mt-1 text-sm text-muted">
              Synced automatically · last {new Date(session.lastSyncedAt).toLocaleString()}
            </p>
          ) : null}
          {status ? <p className="mt-1 text-sm text-primary">{status}</p> : null}
        </Card>
        <Button onClick={syncNow} disabled={busy}>
          {busy ? 'Syncing…' : 'Sync now'}
        </Button>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
        <button
          type="button"
          onClick={busy ? undefined : confirmDelete}
          className="py-2 text-center text-sm text-danger active:opacity-70"
        >
          Delete account
        </button>
      </section>
    );
  }

  // ── Signed out: login / register ───────────────────────────────────────
  return (
    <section className="flex flex-col gap-4">
      <h2 className="display text-xl font-bold">
        {mode === 'register' ? 'Create account' : 'Sign in'}
      </h2>
      <p className="-mt-2 text-sm leading-6 text-muted">
        {mode === 'register'
          ? 'Create an account to back up your training and sync it across devices.'
          : 'Sign in to sync your training across devices.'}
      </p>

      <Card className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Email</label>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Password</label>
          <input
            className={inputClass}
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        {status ? <p className="text-sm text-primary">{status}</p> : null}
      </Card>

      <Button onClick={submit} disabled={busy}>
        {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          setMode(mode === 'register' ? 'login' : 'register');
          setStatus(null);
        }}
      >
        {mode === 'register' ? 'I already have an account' : 'Create a new account'}
      </Button>
    </section>
  );
}
