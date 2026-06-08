import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { log, trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import { colors, fontSize, radius, spacing } from '../../theme';
import { runSync } from './engine';
import { HttpRemoteStore } from './httpRemote';
import {
  clearSyncConfig,
  defaultSyncUrl,
  getSyncConfig,
  isSyncConfigured,
  saveSyncConfig,
  type SyncConfig,
} from './syncConfig';

export function SyncScreen() {
  const repo = useRepository();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getSyncConfig().then((config) => {
      if (config) {
        setUrl(config.url);
        setToken(config.token);
        setConnected(isSyncConfigured(config));
        setLastSyncedAt(config.lastSyncedAt ?? null);
      } else {
        setUrl(defaultSyncUrl());
      }
    });
  }, []);

  const sync = async () => {
    const config: SyncConfig = { url: url.trim(), token: token.trim() };
    if (!isSyncConfigured(config)) {
      Alert.alert('Missing details', 'Enter both the server URL and the sync token.');
      return;
    }
    setBusy(true);
    setStatus('Syncing…');
    try {
      await runSync(repo, new HttpRemoteStore(config.url, config.token));
      const now = Date.now();
      await saveSyncConfig({ ...config, lastSyncedAt: now });
      trackEvent('cloud_synced');
      setConnected(true);
      setLastSyncedAt(now);
      setStatus('Synced');
    } catch (err) {
      log.error('sync failed', err);
      setStatus('Sync failed');
      Alert.alert('Sync failed', String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await clearSyncConfig();
    setConnected(false);
    setToken('');
    setLastSyncedAt(null);
    setStatus(null);
  };

  return (
    <Screen>
      <Text style={styles.title}>Cloud sync</Text>
      <Text style={styles.subtitle}>
        Back up and sync your data across devices via your own sync server (e.g. hosted on Railway).
        Merging is last-write-wins per record, and deletes propagate.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://your-app.up.railway.app"
          placeholderTextColor={colors.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="sync-url"
        />

        <Text style={styles.label}>Sync token</Text>
        <TextInput
          style={styles.input}
          placeholder="Your SYNC_TOKEN secret"
          placeholderTextColor={colors.textMuted}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="sync-token"
        />

        {connected && lastSyncedAt && (
          <Text style={styles.meta}>Last synced {new Date(lastSyncedAt).toLocaleString()}</Text>
        )}
        {status && <Text style={styles.meta}>{status}</Text>}
      </Card>

      <Button
        label={busy ? 'Syncing…' : connected ? 'Sync now' : 'Connect & sync'}
        onPress={sync}
        disabled={busy}
        style={styles.action}
      />
      {connected && (
        <Button label="Disconnect" variant="secondary" onPress={disconnect} style={styles.action} />
      )}

      <Text style={styles.footnote}>
        The token is a shared secret that gates your snapshot — keep it private. See server/README
        for one-time Railway setup.
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
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
