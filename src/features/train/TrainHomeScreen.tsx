import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { ACTIVITY_LABELS, INTENSITY_LABELS } from '../../content/journal';
import type { JournalEntry } from '../../db/types';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import type { TrainStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { dayIndex, trainingDates } from './log';
import { buildDailyRecommendation, type DailyRecommendation } from '../today/recommend';

type Props = NativeStackScreenProps<TrainStackParamList, 'TrainHome'>;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface LoadState {
  journals: JournalEntry[];
  recommendation: DailyRecommendation;
  todayJournalId: string | null;
}

export function TrainHomeScreen({ navigation }: Props) {
  const repo = useRepository();
  const [state, setState] = useState<LoadState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all([
        repo.listJournals(),
        repo.listClimbs(),
        repo.listAssessments(),
        repo.listGoals(),
      ]).then(([journals, climbs, assessments, goals]) => {
        if (!on) return;
        const nowMs = now();
        const recommendation = buildDailyRecommendation({
          weakestArea: assessments[0]?.weakestArea ?? null,
          goals,
          trainingDates: trainingDates(journals, climbs),
          nowMs,
        });
        const todayJournal = journals.find((j) => dayIndex(j.date) === dayIndex(nowMs));
        setState({ journals, recommendation, todayJournalId: todayJournal?.id ?? null });
      });
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (state === null) return <Screen />;
  const { journals, recommendation: rec, todayJournalId } = state;

  return (
    <Screen>
      <Text style={styles.title}>Train</Text>

      <Card style={[styles.todayCard, rec.kind === 'rest' && styles.restCard]}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.todayHeadline}>{rec.headline}</Text>
        <Text style={styles.todayDetail}>{rec.detail}</Text>
        {rec.goalReminders.length > 0 && (
          <View style={styles.goals}>
            <Text style={styles.goalsLabel}>Keep in mind</Text>
            {rec.goalReminders.map((g) => (
              <Text key={g} style={styles.goalItem}>
                • {g}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Button
        label={todayJournalId ? "Edit today's log" : '+ Log today'}
        onPress={() =>
          navigation.navigate('JournalForm', todayJournalId ? { journalId: todayJournalId } : {})
        }
        style={styles.add}
      />
      <Button
        label="Energy & emotion check-in"
        variant="secondary"
        onPress={() => navigation.navigate('EnergyEmotion')}
        style={styles.secondaryAction}
      />
      <Button
        label="Exercise library"
        variant="secondary"
        onPress={() => navigation.navigate('Exercises')}
        style={styles.secondaryAction}
      />

      <Text style={styles.sectionTitle}>Recent</Text>
      {journals.length === 0 ? (
        <Text style={styles.empty}>No entries yet — log your day to start the streak.</Text>
      ) : (
        journals.slice(0, 20).map((j) => (
          <Pressable
            key={j.id}
            onPress={() => navigation.navigate('JournalForm', { journalId: j.id })}
          >
            <Card style={styles.entry}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{formatDate(j.date)}</Text>
                {j.intensity ? (
                  <Text style={styles.entryIntensity}>{INTENSITY_LABELS[j.intensity]}</Text>
                ) : null}
              </View>
              <Text style={styles.entryActivities}>
                {j.activities.length > 0
                  ? j.activities.map((a) => ACTIVITY_LABELS[a]).join(' · ')
                  : 'No activities'}
              </Text>
              {j.summary ? (
                <Text style={styles.entrySummary} numberOfLines={2}>
                  {j.summary}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  todayCard: { marginTop: spacing.md, borderColor: colors.primary },
  restCard: { borderColor: colors.warning },
  todayLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  todayHeadline: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  todayDetail: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  goals: { marginTop: spacing.md },
  goalsLabel: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  goalItem: { color: colors.text, fontSize: fontSize.sm, marginTop: spacing.xs },
  add: { marginTop: spacing.lg },
  secondaryAction: { marginTop: spacing.sm },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: { color: colors.textMuted, fontSize: fontSize.md },
  entry: { marginBottom: spacing.sm },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  entryDate: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  entryIntensity: { color: colors.textMuted, fontSize: fontSize.sm },
  entryActivities: { color: colors.primary, fontSize: fontSize.sm, marginTop: spacing.xs },
  entrySummary: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
