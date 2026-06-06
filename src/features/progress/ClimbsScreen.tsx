import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { DISCIPLINE_LABELS, ENVIRONMENT_LABELS, OUTCOME_LABELS } from '../../content/climbing';
import type { ClimbRecord } from '../../db/types';
import { useRepository } from '../../providers/RepositoryProvider';
import type { ProgressStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<ProgressStackParamList, 'Climbs'>;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ClimbsScreen({ navigation }: Props) {
  const repo = useRepository();
  const [climbs, setClimbs] = useState<ClimbRecord[] | null>(null);

  const load = useCallback(() => {
    let on = true;
    repo.listClimbs().then((c) => {
      if (on) setClimbs(c);
    });
    return () => {
      on = false;
    };
  }, [repo]);

  useFocusEffect(load);

  const remove = (climb: ClimbRecord) =>
    Alert.alert('Delete climb?', `${climb.grade} · ${formatDate(climb.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await repo.deleteClimb(climb.id);
          repo.listClimbs().then(setClimbs);
        },
      },
    ]);

  if (climbs === null) return <Screen />;

  return (
    <Screen>
      <Text style={styles.title}>Climbs</Text>
      <Button
        label="+ Log a climb"
        onPress={() => navigation.navigate('ClimbForm')}
        style={styles.add}
      />

      {climbs.length === 0 ? (
        <Text style={styles.empty}>No climbs logged yet.</Text>
      ) : (
        <>
          <Text style={styles.hint}>Tap to edit · long-press to delete.</Text>
          {climbs.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => navigation.navigate('ClimbForm', { climbId: c.id })}
              onLongPress={() => remove(c)}
            >
              <Card style={styles.climb}>
                <View style={styles.row}>
                  <Text style={styles.grade}>{c.grade}</Text>
                  <Text style={styles.outcome}>{OUTCOME_LABELS[c.outcome]}</Text>
                </View>
                <Text style={styles.meta}>
                  {DISCIPLINE_LABELS[c.discipline]} · {ENVIRONMENT_LABELS[c.environment]} ·{' '}
                  {formatDate(c.date)}
                </Text>
                {c.name ? <Text style={styles.name}>{c.name}</Text> : null}
                {c.location ? <Text style={styles.meta}>{c.location}</Text> : null}
                {c.notes ? <Text style={styles.notes}>{c.notes}</Text> : null}
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  add: { marginTop: spacing.md },
  empty: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.lg },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  climb: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  grade: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '700' },
  outcome: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  name: { color: colors.text, fontSize: fontSize.md, marginTop: spacing.xs },
  notes: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
});
