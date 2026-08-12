import {
  AuthError,
  deleteAccount,
  HttpRemoteStore,
  isSessionExpired,
  login,
  register,
  runSync,
} from '@tfc/core';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { log, trackEvent } from '../../lib/logger';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import { colors, fontSize, radius, spacing } from '../../theme';
import { defaultSyncUrl } from '../sync/syncConfig';
import { clearCachedSuggestion } from '../coach/coachCache';
import { clearSession, getSession, saveSession, type AuthSession } from './session';

type Mode = 'login' | 'register';

export function AccountScreen() {
  const repo = useRepository();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState<Mode>('login');
  const [url, setUrl] = useState(defaultSyncUrl());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const bakedUrl = defaultSyncUrl();

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setReady(true);
    });
  }, []);

  /** Pull+push the user's snapshot, returning the new lastSyncedAt. */
  const doSync = async (s: AuthSession): Promise<number> => {
    await runSync(repo, new HttpRemoteStore(s.url, s.token));
    const syncedAt = now();
    await saveSession({ ...s, lastSyncedAt: syncedAt });
    trackEvent('cloud_synced');
    return syncedAt;
  };

  const submit = async () => {
    const baseUrl = (bakedUrl || url).trim();
    if (!baseUrl) {
      Alert.alert('Missing server', 'Enter your sync server URL.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    setStatus(mode === 'register' ? 'Creating account…' : 'Signing in…');
    try {
      const auth =
        mode === 'register'
          ? await register(baseUrl, email.trim(), password)
          : await login(baseUrl, email.trim(), password);
      const next: AuthSession = {
        url: baseUrl,
        token: auth.token,
        userId: auth.user.id,
        email: auth.user.email,
      };
      await saveSession(next);
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
      Alert.alert(mode === 'register' ? 'Sign-up failed' : 'Sign-in failed', message);
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
      // sign-in form rather than leaving a dead session in place. Local data
      // is untouched; the app stays fully usable offline.
      if (isSessionExpired(err)) {
        log.warn('session expired during sync; signing out');
        await signOut();
        Alert.alert('Session expired', 'Please sign in again to resume syncing.');
        return;
      }
      log.error('sync failed', err);
      setStatus('Sync failed');
      Alert.alert('Sync failed', String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await clearSession();
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
      await deleteAccount(session.url, session.token);
      await clearSession();
      await clearCachedSuggestion();
      trackEvent('account_deleted');
      setSession(null);
      setStatus(null);
      setEmail('');
      setPassword('');
    } catch (err) {
      log.error('delete account failed', err);
      setStatus(null);
      Alert.alert('Delete failed', String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and its cloud backup. Your data on this device is kept, but it will no longer sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: removeAccount },
      ],
    );
  };

  if (!ready) return <Screen />;

  if (session) {
    return (
      <Screen>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>
          Your data is backed up to your account and synced across devices. Merging is
          last-write-wins per record, and deletes propagate.
        </Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{session.email}</Text>
          {session.lastSyncedAt ? (
            <Text style={styles.meta}>
              Last synced {new Date(session.lastSyncedAt).toLocaleString()}
            </Text>
          ) : null}
          {status ? <Text style={styles.meta}>{status}</Text> : null}
        </Card>

        <Button
          label={busy ? 'Syncing…' : 'Sync now'}
          onPress={syncNow}
          disabled={busy}
          style={styles.action}
        />
        <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.action} />
        <Text style={styles.deleteLink} onPress={busy ? undefined : confirmDelete}>
          Delete account
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{mode === 'register' ? 'Create account' : 'Sign in'}</Text>
      <Text style={styles.subtitle}>
        {mode === 'register'
          ? 'Create an account to back up your training and sync it across devices.'
          : 'Sign in to sync your training across devices.'}
      </Text>

      <Card style={styles.card}>
        {!bakedUrl && (
          <>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://your-app.vercel.app/api"
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              testID="account-url"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          testID="account-email"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="account-password"
        />

        {status ? <Text style={styles.meta}>{status}</Text> : null}
      </Card>

      <Button
        label={busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
        onPress={submit}
        disabled={busy}
        style={styles.action}
      />
      <Button
        label={mode === 'register' ? 'I already have an account' : 'Create a new account'}
        variant="secondary"
        onPress={() => {
          setMode(mode === 'register' ? 'login' : 'register');
          setStatus(null);
        }}
        style={styles.action}
      />

      <Text style={styles.footnote}>
        Your password is sent over HTTPS and stored only as a secure hash on your server.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  card: { marginTop: spacing.lg },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: '600', marginBottom: spacing.sm },
  email: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  action: { marginTop: spacing.md },
  deleteLink: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
