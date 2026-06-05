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
import { currentStreak, restRecommended } from './log';

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

export function TrainHomeScreen({ navigation }: Props) {
  const repo = useRepository();
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      repo.listSessions().then((s) => {
        if (on) setSessions(s);
      });
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (sessions === null) return <Screen />;

  const streak = currentStreak(sessions, now());
  const shouldRest = restRecommended(streak);

  return (
    <Screen>
      <Text style={styles.title}>Train</Text>
      <Text style={styles.subtitle}>
        Keep a training notebook. Logging your days lets you spot patterns and avoid overtraining.
      </Text>

      <Card style={[styles.streakCard, shouldRest && styles.streakWarn]}>
        <Text style={styles.streakValue}>
          {streak === 0 ? 'Rested today' : `${streak}-day streak`}
        </Text>
        <Text style={styles.streakNote}>
          {shouldRest
            ? 'You’ve trained 3+ days in a row — Hörst warns this risks overtraining. Consider a rest day.'
            : 'Climbing or training 3–4 days in a row risks overtraining; build in rest days.'}
        </Text>
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
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  streakCard: { marginTop: spacing.lg },
  streakWarn: { borderColor: colors.warning },
  streakValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  streakNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
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
