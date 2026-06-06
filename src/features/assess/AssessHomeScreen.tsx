import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, type NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useRepository } from '../../providers/RepositoryProvider';
import type { AssessStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<AssessStackParamList, 'AssessHome'>;

export function AssessHomeScreen({ navigation }: Props) {
  const repo = useRepository();
  const [count, setCount] = useState<number | null>(null);

  const reload = useCallback(() => {
    let active = true;
    repo.listAssessments().then((list) => {
      if (active) setCount(list.length);
    });
    return () => {
      active = false;
    };
  }, [repo]);

  useFocusEffect(reload);

  return (
    <Screen>
      <Text style={styles.title}>Self-Assessment</Text>
      <Text style={styles.subtitle}>
        Rate 30 statements about your recent climbing. Your answers reveal where you stand across
        the performance triad — Mental, Technical, and Physical — and pinpoint specific weaknesses
        to train.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.cardLabel}>Companion to</Text>
        <Text style={styles.cardValue}>Training for Climbing — Chapter 2</Text>
        {count !== null && (
          <Text style={styles.cardMeta}>
            {count === 0 ? 'No attempts yet' : `${count} attempt${count === 1 ? '' : 's'} saved`}
          </Text>
        )}
      </Card>

      <View style={styles.actions}>
        <Button label="Take the assessment" onPress={() => navigation.navigate('Assessment')} />
        <Button
          label="View history"
          variant="secondary"
          onPress={() => navigation.navigate('History')}
          style={styles.secondaryAction}
        />
        <Button
          label="Fitness evaluation"
          variant="secondary"
          onPress={() => navigation.navigate('Fitness')}
          style={styles.secondaryAction}
        />
      </View>
    </Screen>
  );
}

export type AssessNav = NavigationProp<AssessStackParamList>;

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  card: { marginTop: spacing.lg },
  cardLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  cardValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  cardMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  secondaryAction: {},
});
