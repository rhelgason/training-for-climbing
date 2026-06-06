import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import type { MacrocyclePeriodRecord, SessionRecord } from '../../db/types';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import type { PlanStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { currentPeriod, formatYmd, trainingDaysInRange } from './macrocycle';

type Props = NativeStackScreenProps<PlanStackParamList, 'Macrocycle'>;

interface LoadState {
  periods: MacrocyclePeriodRecord[];
  sessions: SessionRecord[];
}

export function MacrocycleScreen({ navigation }: Props) {
  const repo = useRepository();
  const [state, setState] = useState<LoadState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all([repo.listMacrocyclePeriods(), repo.listSessions()]).then(
        ([periods, sessions]) => {
          if (on) setState({ periods, sessions });
        },
      );
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (state === null) return <Screen />;
  const { periods, sessions } = state;
  const current = currentPeriod(periods, now());

  return (
    <Screen>
      <Text style={styles.title}>Macrocycle</Text>
      <Text style={styles.subtitle}>
        Plan your training year as a sequence of blocks. Each shows the climbing days you logged
        within it, so you can compare plan vs. reality.
      </Text>

      <Button
        label="+ Add a period"
        onPress={() => navigation.navigate('MacrocycleForm')}
        style={styles.add}
      />

      {periods.length === 0 && (
        <Text style={styles.empty}>
          No periods yet. Add blocks like “Winter base”, “Spring power”, or a peaking phase before a
          trip.
        </Text>
      )}

      {periods.map((p) => {
        const isCurrent = current?.id === p.id;
        const days = trainingDaysInRange(sessions, p.startDate, p.endDate);
        return (
          <Pressable
            key={p.id}
            onPress={() => navigation.navigate('MacrocycleForm', { periodId: p.id })}
          >
            <Card style={[styles.period, isCurrent && styles.current]}>
              <View style={styles.periodHeader}>
                <Text style={styles.periodLabel}>{p.label}</Text>
                {isCurrent && <Text style={styles.currentBadge}>current</Text>}
              </View>
              <Text style={styles.dates}>
                {formatYmd(p.startDate)} → {formatYmd(p.endDate)}
              </Text>
              {p.focus ? <Text style={styles.meta}>Focus: {p.focus}</Text> : null}
              {p.objective ? <Text style={styles.meta}>Objective: {p.objective}</Text> : null}
              {p.notes ? <Text style={styles.meta}>{p.notes}</Text> : null}
              <Text style={styles.days}>
                {days} training day{days === 1 ? '' : 's'} logged
              </Text>
            </Card>
          </Pressable>
        );
      })}
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
  add: { marginTop: spacing.lg },
  empty: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.lg, lineHeight: 22 },
  period: { marginTop: spacing.sm },
  current: { borderColor: colors.primary },
  periodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  currentBadge: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  dates: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, lineHeight: 20 },
  days: { color: colors.primary, fontSize: fontSize.sm, marginTop: spacing.sm, fontWeight: '600' },
});
