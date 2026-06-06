import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { FITNESS_TESTS } from '../../content/fitnessEvaluation';
import type { BenchmarkRecord } from '../../db/types';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { daysSinceLastEvaluation, retestDue, trendForTest } from './fitness';

type Props = NativeStackScreenProps<AssessStackParamList, 'Fitness'>;

function deltaText(delta: number | null): string {
  if (delta === null || delta === 0) return '';
  return delta > 0 ? `  ▲ ${delta}` : `  ▼ ${Math.abs(delta)}`;
}

function ResultLine({
  benchmarks,
  testId,
  side,
  label,
}: {
  benchmarks: BenchmarkRecord[];
  testId: string;
  side?: 'left' | 'right';
  label?: string;
}) {
  const trend = trendForTest(benchmarks, testId, side);
  return (
    <Text style={styles.result}>
      {label ? `${label}: ` : ''}
      {trend ? (
        <>
          <Text style={styles.resultValue}>{trend.latest.value}</Text>
          <Text style={styles.resultDelta}>{deltaText(trend.delta)}</Text>
        </>
      ) : (
        <Text style={styles.notRecorded}>not recorded</Text>
      )}
    </Text>
  );
}

export function FitnessScreen({ navigation }: Props) {
  const repo = useRepository();
  const [benchmarks, setBenchmarks] = useState<BenchmarkRecord[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      repo.listBenchmarks().then((b) => {
        if (on) setBenchmarks(b);
      });
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (benchmarks === null) return <Screen />;

  const days = daysSinceLastEvaluation(benchmarks, now());
  const due = retestDue(benchmarks, now());

  return (
    <Screen>
      <Text style={styles.title}>Fitness evaluation</Text>
      <Text style={styles.subtitle}>
        A 10-part strength and flexibility benchmark. Take it annually and compare results to gauge
        your conditioning for climbing.
      </Text>

      <Card style={[styles.reminder, due && styles.reminderDue]}>
        <Text style={styles.reminderText}>
          {days === null
            ? 'No results yet — record your first evaluation to set a baseline.'
            : due
              ? `It’s been ${days} days since your last evaluation — time to retest.`
              : `Last evaluation: ${days} day${days === 1 ? '' : 's'} ago.`}
        </Text>
      </Card>

      <Button
        label="+ Record evaluation"
        onPress={() => navigation.navigate('FitnessForm')}
        style={styles.add}
      />

      {FITNESS_TESTS.map((test) => (
        <Card key={test.id} style={styles.test}>
          <Text style={styles.testName}>{test.name}</Text>
          <Text style={styles.testMetric}>
            {test.metric} ({test.unit})
          </Text>
          {test.bilateral ? (
            <View style={styles.bilateral}>
              <ResultLine benchmarks={benchmarks} testId={test.id} side="left" label="Left" />
              <ResultLine benchmarks={benchmarks} testId={test.id} side="right" label="Right" />
            </View>
          ) : (
            <ResultLine benchmarks={benchmarks} testId={test.id} />
          )}
        </Card>
      ))}

      <Text style={styles.footnote}>
        This evaluation is strenuous — warm up fully and rest between tests.
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
  reminder: { marginTop: spacing.lg },
  reminderDue: { borderColor: colors.warning },
  reminderText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  add: { marginTop: spacing.md },
  test: { marginTop: spacing.sm },
  testName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  testMetric: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  bilateral: { marginTop: spacing.xs },
  result: { color: colors.text, fontSize: fontSize.md, marginTop: spacing.xs },
  resultValue: { color: colors.primary, fontWeight: '700' },
  resultDelta: { color: colors.success, fontSize: fontSize.sm },
  notRecorded: { color: colors.textMuted, fontSize: fontSize.sm, fontStyle: 'italic' },
  footnote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
