import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useRepository } from '../../providers/RepositoryProvider';
import type { PlanStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';
import { activeGoals } from './goals';

type Props = NativeStackScreenProps<PlanStackParamList, 'PlanHome'>;

export function PlanHomeScreen({ navigation }: Props) {
  const repo = useRepository();
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      repo.listGoals().then((g) => {
        if (on) setActiveCount(activeGoals(g).length);
      });
      return () => {
        on = false;
      };
    }, [repo]),
  );

  return (
    <Screen>
      <Text style={styles.title}>Plan</Text>
      <Text style={styles.subtitle}>
        Turn your assessment into action. Set goals across three time horizons and design a session
        that trains the right things in the right order.
      </Text>

      <Pressable onPress={() => navigation.navigate('Goals')}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Goals</Text>
          <Text style={styles.cardBody}>
            Short, medium, and long-term goals — each with a mission and what you&apos;ll give up.
          </Text>
          {activeCount !== null && (
            <Text style={styles.cardMeta}>
              {activeCount === 0 ? 'No active goals yet' : `${activeCount} active`}
            </Text>
          )}
        </Card>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('ProgramBuilder')}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Program builder</Text>
          <Text style={styles.cardBody}>
            Pick your ability tier and focus areas to get an ordered session plan and rest guidance.
          </Text>
        </Card>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Macrocycle')}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Macrocycle</Text>
          <Text style={styles.cardBody}>
            Plan your training year in blocks (base, power, peak, rest) and track climbing days
            against each.
          </Text>
        </Card>
      </Pressable>
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
  card: { marginTop: spacing.lg },
  cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  cardBody: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  cardMeta: {
    color: colors.primary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
});
