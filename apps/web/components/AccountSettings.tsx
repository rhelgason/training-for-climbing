'use client';

import { useEffect, useState } from 'react';
import {
  AuthError,
  HttpRemoteStore,
  deleteAccount,
  log,
  login,
  now,
  register,
  resetPassword,
  runSync,
  trackEvent,
} from '@tfc/core';
import { Button } from './Button';
import { Card } from './Card';
import { useRepository } from '../lib/db/RepositoryProvider';
import { API_BASE } from '../lib/config';
import { clearSession, getSession, saveSession, type AuthSession } from '../lib/auth/session';
import { clearCachedSuggestion } from '../lib/coach/cache';

type Mode = 'login' | 'register' | 'reset';

const inputClass =
  'w-full rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none';

/** A one-time recovery code callout the user must acknowledge. */
function RecoveryCodeCallout({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // clipboard may be unavailable; the code is shown regardless
    }
  };
  return (
    <Card className="border-warning/50 bg-warning/5">
      <h3 className="font-bold text-warning">Save your recovery code</h3>
      <p className="mt-1 text-sm leading-6 text-muted">
        This is the <strong>only</strong> way to reset your password — there’s no email recovery.
        Store it somewhere safe. You won’t see it again.
      </p>
      <p className="my-3 select-all rounded-lg border border-border bg-background px-4 py-3 text-center font-mono text-lg tracking-widest">
        {code}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={copy} className="flex-1">
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        <Button onClick={onDone} className="flex-1">
          I’ve saved it
        </Button>
      </div>
    </Card>
  );
}

export function AccountSettings() {
  const repo = useRepository();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Shown once after register/reset until the user acknowledges it.
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

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

  const afterAuth = async (
    result: { token: string; user: { id: string; email: string }; recoveryCode?: string },
    event: 'signed_in' | 'signed_up',
  ) => {
    const next: AuthSession = {
      token: result.token,
      userId: result.user.id,
      email: result.user.email,
    };
    saveSession(next);
    trackEvent(event);
    setStatus('Syncing…');
    const syncedAt = await doSync(next);
    setSession({ ...next, lastSyncedAt: syncedAt });
    setPassword('');
    setRecoveryCodeInput('');
    setStatus('Synced');
    if (result.recoveryCode) setNewRecoveryCode(result.recoveryCode);
  };

  const submit = async () => {
    if (mode === 'reset') return submitReset();
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
      await afterAuth(result, mode === 'register' ? 'signed_up' : 'signed_in');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (!email.trim() || !recoveryCodeInput.trim() || !password) {
      window.alert('Enter your email, recovery code, and a new password.');
      return;
    }
    setBusy(true);
    setStatus('Resetting password…');
    try {
      const result = await resetPassword(
        API_BASE,
        email.trim(),
        recoveryCodeInput.trim(),
        password,
      );
      await afterAuth(result, 'signed_in');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleError = (err: unknown) => {
    const message = err instanceof AuthError ? err.message : String((err as Error).message ?? err);
    log.error('auth failed', err);
    setStatus(null);
    window.alert(message);
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
        {newRecoveryCode && (
          <RecoveryCodeCallout code={newRecoveryCode} onDone={() => setNewRecoveryCode(null)} />
        )}
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

  // ── Signed out: login / register / reset ───────────────────────────────
  const title =
    mode === 'register' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
  return (
    <section className="flex flex-col gap-4">
      <h2 className="display text-xl font-bold">Account</h2>
      {newRecoveryCode && (
        <RecoveryCodeCallout code={newRecoveryCode} onDone={() => setNewRecoveryCode(null)} />
      )}
      <p className="-mt-2 text-sm leading-6 text-muted">
        {mode === 'reset'
          ? 'Enter your recovery code to set a new password.'
          : mode === 'register'
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

        {mode === 'reset' && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Recovery code</label>
            <input
              className={`${inputClass} font-mono tracking-widest`}
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={recoveryCodeInput}
              onChange={(e) => setRecoveryCodeInput(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold">
            {mode === 'reset' ? 'New password' : 'Password'}
          </label>
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
        {busy
          ? 'Please wait…'
          : mode === 'register'
            ? 'Create account'
            : mode === 'reset'
              ? 'Reset password'
              : 'Sign in'}
      </Button>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        {mode !== 'register' && (
          <button
            type="button"
            className="font-semibold text-primary"
            onClick={() => {
              setMode('register');
              setStatus(null);
            }}
          >
            Create a new account
          </button>
        )}
        {mode !== 'login' && (
          <button
            type="button"
            className="font-semibold text-primary"
            onClick={() => {
              setMode('login');
              setStatus(null);
            }}
          >
            I already have an account
          </button>
        )}
        {mode !== 'reset' && (
          <button
            type="button"
            className="text-muted"
            onClick={() => {
              setMode('reset');
              setStatus(null);
            }}
          >
            Forgot password?
          </button>
        )}
      </div>
    </section>
  );
}
