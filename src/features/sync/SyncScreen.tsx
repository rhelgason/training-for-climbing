import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { log, trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import { colors, fontSize, radius, spacing } from '../../theme';
import { runSync } from './engine';
import { SupabaseRemoteStore } from './supabaseRemote';

export function SyncScreen() {
  const repo = useRepository();
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    const supabase = getSupabase();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      Alert.alert('Check your email', 'We sent you a magic link to sign in.');
    } catch (err) {
      log.error('sign-in failed', err);
      Alert.alert('Sign-in failed', String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
  };

  const syncNow = async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setBusy(true);
    setStatus('Syncing…');
    try {
      await runSync(repo, new SupabaseRemoteStore(supabase, session.user.id));
      trackEvent('cloud_synced');
      setLastSynced(Date.now());
      setStatus('Synced');
    } catch (err) {
      log.error('sync failed', err);
      setStatus('Sync failed');
      Alert.alert('Sync failed', String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <Screen>
        <Text style={styles.title}>Cloud sync</Text>
        <Card style={styles.card}>
          <Text style={styles.body}>
            Cloud sync isn’t configured. Your data is saved locally on this device.
          </Text>
          <Text style={styles.body}>
            To enable it, set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see the
            README) and restart the app.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Cloud sync</Text>
      <Text style={styles.subtitle}>
        Back up and sync your data across devices. Merging is last-write-wins per record.
      </Text>

      {!ready ? null : session ? (
        <>
          <Card style={styles.card}>
            <Text style={styles.body}>Signed in as {session.user.email ?? session.user.id}</Text>
            {lastSynced && (
              <Text style={styles.meta}>
                Last synced {new Date(lastSynced).toLocaleTimeString()}
              </Text>
            )}
            {status && <Text style={styles.meta}>{status}</Text>}
          </Card>
          <Button
            label={busy ? 'Syncing…' : 'Sync now'}
            onPress={syncNow}
            disabled={busy}
            style={styles.action}
          />
          <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.action} />
        </>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.body}>Sign in with your email to enable sync.</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            label={busy ? 'Sending…' : 'Send magic link'}
            onPress={signIn}
            disabled={busy}
            style={styles.action}
          />
        </Card>
      )}

      <Text style={styles.footnote}>
        Note: deletes don’t yet propagate between devices (no tombstones in v1).
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
  body: { color: colors.text, fontSize: fontSize.md, lineHeight: 22, marginBottom: spacing.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  action: { marginTop: spacing.md },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
