import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { createRepository, type Repository } from '../db';
import { log, registerEventSink, trackEvent } from '../lib/logger';
import { colors, fontSize, spacing } from '../theme';

interface RepositoryContextValue {
  repo: Repository;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

/**
 * Creates and initialises the Repository once, wires usage events to it, and
 * blocks rendering of children until the local store is ready.
 *
 * `repository` may be injected (e.g. an InMemoryRepository in tests); otherwise
 * the platform default is used.
 */
export function RepositoryProvider({
  children,
  repository,
}: {
  children: React.ReactNode;
  repository?: Repository;
}) {
  const repo = useMemo(() => repository ?? createRepository(), [repository]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await repo.init();
        // Persist usage events to the local store.
        registerEventSink((event) => {
          repo.recordEvent(event).catch((err) => log.error('failed to persist event', err));
        });
        if (!cancelled) {
          setReady(true);
          trackEvent('app_opened');
        }
      } catch (err) {
        log.error('repository init failed', err);
        if (!cancelled) setError(err as Error);
      }
    })();
    return () => {
      cancelled = true;
      registerEventSink(null);
    };
  }, [repo]);

  const value = useMemo(() => ({ repo }), [repo]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not open local storage.</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

/** Access the initialised Repository. Throws if used outside the provider. */
export function useRepository(): Repository {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used within a RepositoryProvider');
  return ctx.repo;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: fontSize.lg, fontWeight: '600' },
  errorSubtext: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
});
