import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TRIAD_AREAS, TRIAD_LABELS } from '../../content/types';
import type { AssessmentRecord } from '../../db';
import { useRepository } from '../../providers/RepositoryProvider';
import { trackEvent } from '../../lib/logger';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing, triadColors } from '../../theme';

type Props = NativeStackScreenProps<AssessStackParamList, 'History'>;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function HistoryScreen({ navigation }: Props) {
  const repo = useRepository();
  const [items, setItems] = useState<AssessmentRecord[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      trackEvent('assessment_viewed_history');
      repo.listAssessments().then((list) => {
        if (active) setItems(list);
      });
      return () => {
        active = false;
      };
    }, [repo]),
  );

  if (items === null) return <Screen />;

  if (items.length === 0) {
    return (
      <Screen>
        <Text style={styles.title}>History</Text>
        <Text style={styles.empty}>
          No saved assessments yet. Take the assessment to start tracking your progress over time.
        </Text>
        <Button
          label="Take the assessment"
          onPress={() => navigation.replace('Assessment')}
          style={styles.action}
        />
      </Screen>
    );
  }

  // Trend: compare the latest attempt's total to the previous one.
  const total = (a: AssessmentRecord) => a.mental + a.technical + a.physical;
  const latest = items[0];
  const previous = items[1];
  const delta = previous ? total(latest) - total(previous) : null;

  return (
    <Screen>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>
        {items.length} attempt{items.length === 1 ? '' : 's'}
        {delta !== null && (
          <Text style={{ color: delta >= 0 ? colors.success : colors.danger }}>
            {'  ·  '}
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs previous
          </Text>
        )}
      </Text>

      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => navigation.navigate('Results', { assessmentId: item.id })}
        >
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.weakest}>weakest: {TRIAD_LABELS[item.weakestArea]}</Text>
            </View>
            <View style={styles.scores}>
              {TRIAD_AREAS.map((area) => (
                <View key={area} style={styles.scoreCell}>
                  <Text style={[styles.scoreValue, { color: triadColors[area] }]}>
                    {item[area]}
                  </Text>
                  <Text style={styles.scoreLabel}>{TRIAD_LABELS[area]}</Text>
                </View>
              ))}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  empty: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.md, lineHeight: 22 },
  action: { marginTop: spacing.lg },
  card: { marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  date: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  weakest: { color: colors.textMuted, fontSize: fontSize.sm },
  scores: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreCell: { alignItems: 'center', flex: 1 },
  scoreValue: { fontSize: fontSize.xl, fontWeight: '700' },
  scoreLabel: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
});
