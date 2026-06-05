import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TriadBars } from '../../components/TriadBars';
import { TRIAD_LABELS } from '../../content/types';
import type { AssessmentRecord } from '../../db';
import { useRepository } from '../../providers/RepositoryProvider';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { evaluate } from './scoring';

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
          ? `Targets to train (${result.flagged.length})`
          : 'No flagged weaknesses — nicely done!'}
      </Text>
      {result.flagged.map(({ question, rating }) => (
        <Card key={question.id} style={styles.flag}>
          <View style={styles.flagHeader}>
            <Text style={styles.flagArea}>{TRIAD_LABELS[question.triad]}</Text>
            <Text style={styles.flagScore}>scored {rating}/5</Text>
          </View>
          <Text style={styles.flagPrompt}>{question.prompt}</Text>
          <Text style={styles.flagTip}>{question.tip}</Text>
          <Text style={styles.flagRef}>
            Revisit chapter{question.chapterRefs.length > 1 ? 's' : ''}{' '}
            {question.chapterRefs.join(', ')}
          </Text>
        </Card>
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
  flag: { marginBottom: spacing.sm },
  flagHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  flagArea: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  flagScore: { color: colors.warning, fontSize: fontSize.sm },
  flagPrompt: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  flagTip: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  flagRef: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  actions: { marginTop: spacing.lg, gap: spacing.md },
});
