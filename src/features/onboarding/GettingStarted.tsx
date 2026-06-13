import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { colors, fontSize, spacing } from '../../theme';

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  onPress: () => void;
}

/**
 * First-run checklist that orients a new user through the core loop: assess →
 * set a goal → log a day. Each item checks off as it's completed; the host hides
 * the whole card once everything's done or it's dismissed.
 */
export function GettingStarted({
  steps,
  onDismiss,
}: {
  steps: OnboardingStep[];
  onDismiss: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Getting started</Text>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>Dismiss</Text>
        </Pressable>
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.key}
          onPress={step.done ? undefined : step.onPress}
          style={styles.step}
          testID={`onboarding-${step.key}`}
        >
          <Text style={[styles.check, step.done && styles.checkDone]}>{step.done ? '✓' : '○'}</Text>
          <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, borderColor: colors.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  dismiss: { color: colors.textMuted, fontSize: fontSize.sm },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  check: { color: colors.textMuted, fontSize: fontSize.lg, width: 22 },
  checkDone: { color: colors.success },
  stepLabel: { color: colors.text, fontSize: fontSize.md, flex: 1 },
  stepLabelDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
