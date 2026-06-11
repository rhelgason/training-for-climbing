import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useCoach } from '../coach/useCoach';
import { relativeTime } from '../coach/format';
import { useBackupNudge } from '../auth/useBackupNudge';
import { BackupBanner } from '../auth/BackupBanner';

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
  const coach = useCoach(repo);
  const backup = useBackupNudge();

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
  const ai = coach.suggestion;

  return (
    <Screen>
      <Text style={styles.title}>Train</Text>

      {backup.visible && (
        <BackupBanner
          onSignIn={() => {
            backup.dismiss();
            navigation.getParent()?.navigate('More', { screen: 'Account' });
          }}
          onDismiss={backup.dismiss}
        />
      )}

      <Card style={[styles.todayCard, rec.kind === 'rest' && styles.restCard, ai && styles.aiCard]}>
        <View style={styles.todayHeader}>
          <Text style={[styles.todayLabel, ai && styles.aiLabel]}>{ai ? 'AI coach' : 'Today'}</Text>
          {coach.status === 'loading' ? (
            <ActivityIndicator size="small" color={colors.success} testID="coach-spinner" />
          ) : ai && coach.generatedAt ? (
            <Text style={styles.todayUpdated}>
              updated {relativeTime(coach.generatedAt, now())}
            </Text>
          ) : null}
        </View>
        <Text style={styles.todayHeadline}>{ai ? ai.headline : rec.headline}</Text>
        <Text style={styles.todayDetail}>{ai ? ai.rationale || rec.detail : rec.detail}</Text>

        {(ai ? ai.plan : rec.plan).length > 0 && (
          <View style={styles.plan}>
            <Text style={styles.planLabel}>Today&apos;s plan</Text>
            {(ai ? ai.plan : rec.plan).map((step, i) => (
              <View key={i} style={styles.planStep}>
                <Text style={styles.planNum}>{i + 1}</Text>
                <Text style={styles.planText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {ai && ai.watchOuts.length > 0 && (
          <View style={styles.goals}>
            <Text style={styles.goalsLabel}>Watch out for</Text>
            {ai.watchOuts.map((w) => (
              <Text key={w} style={styles.goalItem}>
                • {w}
              </Text>
            ))}
          </View>
        )}

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

      {coach.enabled && (
        <Button
          label={
            coach.status === 'loading'
              ? 'Asking your coach…'
              : ai
                ? 'Refresh AI suggestion'
                : 'Get AI suggestion'
          }
          variant="secondary"
          onPress={coach.refresh}
          disabled={coach.status === 'loading'}
          style={styles.secondaryAction}
        />
      )}
      {coach.status === 'error' && (
        <Text style={styles.coachError}>
          Couldn&apos;t reach your coach — showing the built-in plan instead.
        </Text>
      )}

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
  aiCard: { borderColor: colors.success },
  todayLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiLabel: { color: colors.success },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayUpdated: { color: colors.textMuted, fontSize: fontSize.sm },
  coachError: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    fontStyle: 'italic',
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
  plan: { marginTop: spacing.md },
  planLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  planStep: { flexDirection: 'row', marginTop: spacing.xs },
  planNum: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    width: 20,
  },
  planText: { color: colors.text, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
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
