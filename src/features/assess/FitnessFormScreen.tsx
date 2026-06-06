import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { FITNESS_TESTS } from '../../content/fitnessEvaluation';
import type { NewBenchmark } from '../../db/types';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<AssessStackParamList, 'FitnessForm'>;

function parseValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function NumberField({
  value,
  onChange,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  testID: string;
}) {
  return (
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      placeholder="—"
      placeholderTextColor={colors.textMuted}
      value={value}
      onChangeText={onChange}
      testID={testID}
    />
  );
}

export function FitnessFormScreen({ navigation }: Props) {
  const repo = useRepository();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      const date = now();
      const toSave: NewBenchmark[] = [];
      for (const test of FITNESS_TESTS) {
        if (test.bilateral) {
          const left = parseValue(values[`${test.id}:left`]);
          const right = parseValue(values[`${test.id}:right`]);
          if (left !== null) toSave.push({ testId: test.id, side: 'left', value: left, date });
          if (right !== null) toSave.push({ testId: test.id, side: 'right', value: right, date });
        } else {
          const v = parseValue(values[test.id]);
          if (v !== null) toSave.push({ testId: test.id, value: v, date });
        }
      }
      for (const b of toSave) {
        await repo.saveBenchmark(b);
        trackEvent('benchmark_recorded', { testId: b.testId });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Record evaluation</Text>
      <Text style={styles.subtitle}>
        Enter the tests you completed today; leave the rest blank.
      </Text>

      {FITNESS_TESTS.map((test) => (
        <View key={test.id} style={styles.test}>
          <Text style={styles.testName}>{test.name}</Text>
          <Text style={styles.testInstructions}>{test.instructions}</Text>
          <Text style={styles.testMetric}>
            {test.metric} ({test.unit})
          </Text>
          {test.bilateral ? (
            <View style={styles.bilateral}>
              <View style={styles.bilateralField}>
                <Text style={styles.sideLabel}>Left</Text>
                <NumberField
                  value={values[`${test.id}:left`] ?? ''}
                  onChange={(v) => set(`${test.id}:left`, v)}
                  testID={`fitness-${test.id}-left`}
                />
              </View>
              <View style={styles.bilateralField}>
                <Text style={styles.sideLabel}>Right</Text>
                <NumberField
                  value={values[`${test.id}:right`] ?? ''}
                  onChange={(v) => set(`${test.id}:right`, v)}
                  testID={`fitness-${test.id}-right`}
                />
              </View>
            </View>
          ) : (
            <NumberField
              value={values[test.id] ?? ''}
              onChange={(v) => set(test.id, v)}
              testID={`fitness-${test.id}`}
            />
          )}
        </View>
      ))}

      <Button
        label={saving ? 'Saving…' : 'Save results'}
        onPress={onSave}
        disabled={saving}
        style={styles.save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  test: { marginTop: spacing.lg },
  testName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  testInstructions: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  testMetric: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
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
  bilateral: { flexDirection: 'row', gap: spacing.md },
  bilateralField: { flex: 1 },
  sideLabel: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  save: { marginTop: spacing.xl },
});
