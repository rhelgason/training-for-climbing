import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { colors, fontSize, spacing } from '../../theme';

/**
 * A gentle, dismissible prompt to sign in for cloud backup. Shown only when the
 * user is signed out (see useBackupNudge). The app works fully without it.
 */
export function BackupBanner({
  onSignIn,
  onDismiss,
}: {
  onSignIn: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Your training isn&apos;t backed up</Text>
      <Text style={styles.body}>
        Create a free account to back up your data and sync it across devices. You can keep using
        the app without one.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={onSignIn} hitSlop={8}>
          <Text style={styles.signIn}>Sign in</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>Not now</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, borderColor: colors.primary },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  signIn: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  dismiss: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
});
