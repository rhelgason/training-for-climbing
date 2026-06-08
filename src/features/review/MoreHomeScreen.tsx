import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { GLOSSARY } from '../../content/glossary';
import type { MoreStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

export function MoreHomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>Your profile, settings, and reference.</Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Profile & settings</Text>
        <Text style={styles.cardBody}>
          Ability tier, default discipline, reassessment cadence, and the AI coach.
        </Text>
        <Button
          label="Open profile"
          onPress={() => navigation.navigate('Profile')}
          style={styles.action}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Cloud sync</Text>
        <Text style={styles.cardBody}>Back up your data and sync it across devices.</Text>
        <Button
          label="Open cloud sync"
          variant="secondary"
          onPress={() => navigation.navigate('Sync')}
          style={styles.action}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Glossary</Text>
        <Text style={styles.cardBody}>
          {GLOSSARY.length} key climbing and training terms, searchable.
        </Text>
        <Button
          label="Open glossary"
          variant="secondary"
          onPress={() => navigation.navigate('Glossary')}
          style={styles.action}
        />
      </Card>
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
  action: { marginTop: spacing.md },
});
