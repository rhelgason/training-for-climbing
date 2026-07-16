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
  requestPasswordReset,
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
type ResetStep = 'request' | 'confirm';

const inputClass =
  'w-full rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none';

export function AccountSettings() {
  const repo = useRepository();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<Mode>('login');
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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

  const afterAuth = async (
    result: { token: string; user: { id: string; email: string } },
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
    setCode('');
    setStatus('Synced');
  };

  const handleError = (err: unknown) => {
    const message = err instanceof AuthError ? err.message : String((err as Error).message ?? err);
    log.error('auth failed', err);
    setStatus(null);
    window.alert(message);
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
    if (resetStep === 'request') {
      if (!email.trim()) {
        window.alert('Enter your email.');
        return;
      }
      setBusy(true);
      setStatus('Emailing a reset code…');
      try {
        await requestPasswordReset(API_BASE, email.trim());
        setResetStep('confirm');
        setStatus(`If an account exists for ${email.trim()}, a 6-digit code is on its way.`);
      } catch (err) {
        handleError(err);
      } finally {
        setBusy(false);
      }
      return;
    }
    // confirm step
    if (!code.trim() || !password) {
      window.alert('Enter the code from your email and a new password.');
      return;
    }
    setBusy(true);
    setStatus('Resetting password…');
    try {
      const result = await resetPassword(API_BASE, email.trim(), code.trim(), password);
      await afterAuth(result, 'signed_in');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const startReset = () => {
    setMode('reset');
    setResetStep('request');
    setStatus(null);
    setCode('');
    setPassword('');
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
      <h2 className="display text-xl font-bold">{title}</h2>
      <p className="-mt-2 text-sm leading-6 text-muted">
        {mode === 'reset'
          ? resetStep === 'request'
            ? 'Enter your email and we’ll send a reset code.'
            : 'Enter the code from your email and a new password.'
          : mode === 'register'
            ? 'Create an account to back up your training and sync it across devices.'
            : 'Sign in to sync your training across devices.'}
      </p>

      <Card className="flex flex-col gap-3">
        {/* Email — shown for all modes except the reset "confirm" step. */}
        {!(mode === 'reset' && resetStep === 'confirm') && (
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
        )}

        {mode === 'reset' && resetStep === 'confirm' && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Reset code</label>
            <input
              className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
              type="text"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}

        {/* Password — for login, register, and the reset confirm step. */}
        {!(mode === 'reset' && resetStep === 'request') && (
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
        )}

        {status ? <p className="text-sm text-primary">{status}</p> : null}
      </Card>

      <Button onClick={submit} disabled={busy}>
        {busy
          ? 'Please wait…'
          : mode === 'register'
            ? 'Create account'
            : mode === 'reset'
              ? resetStep === 'request'
                ? 'Email me a reset code'
                : 'Reset password'
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
          <button type="button" className="text-muted" onClick={startReset}>
            Forgot password?
          </button>
        )}
      </div>
    </section>
  );
}
