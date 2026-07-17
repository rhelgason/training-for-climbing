import { evaluate, groupFlaggedByArea, TRIAD_LABELS, WEAKNESS_THRESHOLD } from '@tfc/core';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TriadBars } from '../../components/TriadBars';
import type { AssessmentRecord } from '../../db';
import { useRepository } from '../../providers/RepositoryProvider';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<AssessStackParamList, 'Results'>;

export function ResultsScreen({ navigation, route }: Props) {
  const repo = useRepository();
  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    repo
      .getAssessment(route.params.assessmentId)
      .then(setRecord)
      .finally(() => setLoading(false));
  }, [repo, route.params.assessmentId]);

  if (loading) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen>
        <Text style={styles.title}>Result not found</Text>
        <Button label="Back" onPress={() => navigation.popToTop()} style={styles.action} />
      </Screen>
    );
  }

  const result = evaluate(record.responses);
  const weakestLabel = TRIAD_LABELS[result.weakestArea];

  return (
    <Screen>
      <Text style={styles.title}>Your results</Text>

      <Card style={styles.section}>
        <TriadBars
          scores={result.scores}
          maxPerArea={result.maxPerArea}
          weakestArea={result.weakestArea}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.headline}>
          {result.balanced
            ? 'Balanced abilities — all three areas are within 5 points.'
            : `Your weakest area is ${weakestLabel}.`}
        </Text>
        <Text style={styles.body}>
          {result.balanced
            ? 'Keep building all three pillars together as you push your limit.'
            : `Focus your short- and medium-term training on ${weakestLabel.toLowerCase()} skills first.`}
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>
        {result.flagged.length > 0
          ? `Weak spots — rated ${WEAKNESS_THRESHOLD} or lower (${result.flagged.length})`
          : `No statements rated ${WEAKNESS_THRESHOLD} or lower — nicely done!`}
      </Text>
      {result.flagged.length > 0 && (
        <Text style={styles.flagIntro}>
          Each of these is a specific element holding you back. Focus your short- and medium-term
          goals on the five or six lowest-scoring items, and use the exercise library and your daily
          plan to address them.
        </Text>
      )}
      {groupFlaggedByArea(result.flagged).map((group) => (
        <View key={group.area} style={styles.flagGroup}>
          <Text style={styles.flagGroupTitle}>{TRIAD_LABELS[group.area]}</Text>
          {group.items.map(({ question, rating }) => (
            <Card key={question.id} style={styles.flag}>
              <View style={styles.flagHeader}>
                <Text style={styles.flagScore}>rated {rating}/5</Text>
              </View>
              <Text style={styles.flagPrompt}>{question.prompt}</Text>
            </Card>
          ))}
        </View>
      ))}

      <View style={styles.actions}>
        <Button
          label="View history"
          variant="secondary"
          onPress={() => navigation.replace('History')}
        />
        <Button label="Done" onPress={() => navigation.popToTop()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  action: { marginTop: spacing.lg },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.md },
  headline: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  body: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.sm, lineHeight: 22 },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  flagIntro: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  flagGroup: { marginBottom: spacing.md },
  flagGroupTitle: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  flag: { marginBottom: spacing.sm },
  flagHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.xs },
  flagScore: { color: colors.warning, fontSize: fontSize.sm },
  flagPrompt: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  actions: { marginTop: spacing.lg, gap: spacing.md },
});
