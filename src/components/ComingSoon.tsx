import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from './Card';
import { Screen } from './Screen';
import { colors, fontSize, spacing } from '../theme';

/** Placeholder for pillars not yet built (Plan, Train), per the phased roadmap. */
export function ComingSoon({
  title,
  blurb,
  roadmap,
}: {
  title: string;
  blurb: string;
  roadmap: string[];
}) {
  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.blurb}>{blurb}</Text>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Planned for this section</Text>
        {roadmap.map((item) => (
          <Text key={item} style={styles.item}>
            • {item}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  blurb: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.sm, lineHeight: 22 },
  card: { marginTop: spacing.lg },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  item: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 24 },
});
