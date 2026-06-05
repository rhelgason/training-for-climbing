import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TRAINING_HIERARCHY, type HierarchyAreaId } from '../../content/planning';
import type { SessionRecord } from '../../db/types';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import type { TrainStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { buildDailyRecommendation, type DailyRecommendation } from '../today/recommend';

type Props = NativeStackScreenProps<TrainStackParamList, 'TrainHome'>;

const AREA_NAME: Record<HierarchyAreaId, string> = Object.fromEntries(
  TRAINING_HIERARCHY.map((a) => [a.id, a.name]),
) as Record<HierarchyAreaId, string>;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface LoadState {
  sessions: SessionRecord[];
  recommendation: DailyRecommendation;
}

export function TrainHomeScreen({ navigation }: Props) {
  const repo = useRepository();
  const [state, setState] = useState<LoadState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all([repo.listSessions(), repo.listAssessments(), repo.listGoals()]).then(
        ([sessions, assessments, goals]) => {
          if (!on) return;
          const recommendation = buildDailyRecommendation({
            weakestArea: assessments[0]?.weakestArea ?? null,
            goals,
            sessions,
            nowMs: now(),
          });
          setState({ sessions, recommendation });
        },
      );
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (state === null) return <Screen />;
  const { sessions, recommendation: rec } = state;

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
        label="+ Log a session"
        onPress={() => navigation.navigate('SessionForm')}
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
      {sessions.length === 0 ? (
        <Text style={styles.empty}>No sessions logged yet.</Text>
      ) : (
        sessions.slice(0, 20).map((s) => (
          <Card key={s.id} style={styles.session}>
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
            </View>
            <Text style={styles.sessionAreas}>
              {s.focusAreas.length > 0
                ? s.focusAreas.map((a) => AREA_NAME[a]).join(' · ')
                : 'No focus areas'}
            </Text>
            {s.notes ? <Text style={styles.sessionNotes}>{s.notes}</Text> : null}
          </Card>
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
  session: { marginBottom: spacing.sm },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sessionDate: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  sessionAreas: { color: colors.primary, fontSize: fontSize.sm, marginTop: spacing.xs },
  sessionNotes: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
