import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { RatingSelector } from '../../components/RatingSelector';
import { Screen } from '../../components/Screen';
import { RATING_LABELS, SELF_ASSESSMENT_QUESTIONS } from '../../content/selfAssessment';
import { useRepository } from '../../providers/RepositoryProvider';
import { trackEvent } from '../../lib/logger';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { evaluate, isComplete, unansweredQuestionIds, type Responses } from './scoring';

type Props = NativeStackScreenProps<AssessStackParamList, 'Assessment'>;

export function AssessmentScreen({ navigation }: Props) {
  const repo = useRepository();
  const [responses, setResponses] = useState<Responses>({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    trackEvent('assessment_started');
  }, []);

  const answeredCount = useMemo(() => Object.keys(responses).length, [responses]);
  const complete = isComplete(responses);

  const setRating = (id: number, value: number) =>
    setResponses((prev) => ({ ...prev, [id]: value }));

  const onSubmit = async () => {
    if (!complete) {
      const missing = unansweredQuestionIds(responses);
      Alert.alert(
        'Almost there',
        `Please answer all questions. ${missing.length} remaining (e.g. #${missing[0]}).`,
      );
      return;
    }
    setSaving(true);
    try {
      const result = evaluate(responses);
      const saved = await repo.saveAssessment({
        responses,
        mental: result.scores.mental,
        technical: result.scores.technical,
        physical: result.scores.physical,
        weakestArea: result.weakestArea,
      });
      trackEvent('assessment_completed', {
        mental: result.scores.mental,
        technical: result.scores.technical,
        physical: result.scores.physical,
        weakestArea: result.weakestArea,
      });
      navigation.replace('Results', { assessmentId: saved.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Rate your recent climbing</Text>
      <Card style={styles.legend}>
        <Text style={styles.legendTitle}>Scale</Text>
        {RATING_LABELS.map((label, i) => (
          <Text key={label} style={styles.legendLine}>
            <Text style={styles.legendNum}>{i}</Text> — {label}
          </Text>
        ))}
      </Card>

      {SELF_ASSESSMENT_QUESTIONS.map((q) => (
        <View key={q.id} style={styles.question}>
          <Text style={styles.prompt}>
            {q.id}. {q.prompt}
          </Text>
          <RatingSelector
            value={responses[q.id]}
            onChange={(v) => setRating(q.id, v)}
            testIDPrefix={`q${q.id}`}
          />
        </View>
      ))}

      <Text style={styles.progress}>
        {answeredCount}/{SELF_ASSESSMENT_QUESTIONS.length} answered
      </Text>
      <Button
        label={saving ? 'Saving…' : 'See results'}
        onPress={onSubmit}
        disabled={saving}
        style={styles.submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.md },
  legend: { marginBottom: spacing.lg },
  legendTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  legendLine: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  legendNum: { color: colors.text, fontWeight: '700' },
  question: { marginBottom: spacing.lg },
  prompt: { color: colors.text, fontSize: fontSize.md, lineHeight: 22, marginBottom: spacing.sm },
  progress: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  submit: { marginTop: spacing.md },
});
