import {
  GOAL_HORIZON_LABELS,
  type GoalRecord,
  groupGoalsByHorizon,
  HORIZON_ORDER,
  isOverdue,
  TRIAD_LABELS,
} from '@tfc/core';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { PlanStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<PlanStackParamList, 'Goals'>;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function GoalsScreen({ navigation }: Props) {
  const repo = useRepository();
  const [goals, setGoals] = useState<GoalRecord[] | null>(null);

  const load = useCallback(() => {
    let on = true;
    repo.listGoals().then((g) => {
      if (on) setGoals(g);
    });
    return () => {
      on = false;
    };
  }, [repo]);

  useFocusEffect(load);

  const refresh = () => repo.listGoals().then(setGoals);

  const toggleDone = async (goal: GoalRecord) => {
    if (goal.status === 'done') {
      await repo.updateGoal(goal.id, { status: 'active', completedAt: undefined });
    } else {
      await repo.updateGoal(goal.id, { status: 'done', completedAt: now() });
      trackEvent('goal_completed', { horizon: goal.horizon });
    }
    refresh();
  };

  const remove = (goal: GoalRecord) =>
    Alert.alert('Delete goal?', goal.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await repo.deleteGoal(goal.id);
          trackEvent('goal_deleted', { horizon: goal.horizon });
          refresh();
        },
      },
    ]);

  if (goals === null) return <Screen />;

  const grouped = groupGoalsByHorizon(goals);
  const currentTime = now();

  return (
    <Screen>
      <Text style={styles.title}>Goals</Text>
      <Button
        label="+ Add a goal"
        onPress={() => navigation.navigate('GoalForm')}
        style={styles.add}
      />

      {goals.length === 0 && (
        <Text style={styles.empty}>
          No goals yet. Add your first — short-term for today, medium-term for the season, long-term
          for your dream send.
        </Text>
      )}

      {HORIZON_ORDER.map((horizon) => {
        const list = grouped[horizon];
        if (list.length === 0) return null;
        return (
          <View key={horizon} style={styles.group}>
            <Text style={styles.groupTitle}>{GOAL_HORIZON_LABELS[horizon]}</Text>
            {list.map((goal) => (
              <Pressable
                key={goal.id}
                onPress={() => navigation.navigate('GoalForm', { goalId: goal.id })}
              >
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.goalTitle, goal.status === 'done' && styles.done]}>
                      {goal.title}
                    </Text>
                    {goal.triadArea && (
                      <Text style={styles.tag}>{TRIAD_LABELS[goal.triadArea]}</Text>
                    )}
                  </View>
                  {goal.mission ? <Text style={styles.meta}>Mission: {goal.mission}</Text> : null}
                  {goal.sacrifice ? (
                    <Text style={styles.meta}>Giving up: {goal.sacrifice}</Text>
                  ) : null}
                  {goal.targetDate ? (
                    <Text style={[styles.meta, isOverdue(goal, currentTime) && styles.overdue]}>
                      Due {formatDate(goal.targetDate)}
                      {isOverdue(goal, currentTime) ? ' · overdue' : ''}
                    </Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <Button
                      label={goal.status === 'done' ? 'Reactivate' : 'Mark done'}
                      variant="secondary"
                      onPress={() => toggleDone(goal)}
                      style={styles.cardAction}
                    />
                    <Button
                      label="Delete"
                      variant="secondary"
                      onPress={() => remove(goal)}
                      style={styles.cardAction}
                    />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  add: { marginTop: spacing.md },
  empty: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.lg, lineHeight: 22 },
  group: { marginTop: spacing.lg },
  groupTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '600', flex: 1 },
  done: { textDecorationLine: 'line-through', color: colors.textMuted },
  tag: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700', marginLeft: spacing.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
  overdue: { color: colors.danger },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cardAction: { flex: 1, paddingVertical: spacing.sm },
});
