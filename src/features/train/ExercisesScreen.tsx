import {
  CATEGORY_FILTERS,
  type CategoryFilter,
  categoryFilterLabel,
  EXERCISE_CATEGORY_LABELS,
  EXERCISES,
  filterByCategory,
} from '@tfc/core';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../components/Card';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { colors, fontSize, spacing } from '../../theme';

const FILTER_OPTIONS: ChipOption<CategoryFilter>[] = CATEGORY_FILTERS.map((f) => ({
  label: categoryFilterLabel(f),
  value: f,
}));

export function ExercisesScreen() {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const results = useMemo(() => filterByCategory(EXERCISES, filter), [filter]);

  return (
    <Screen>
      <Text style={styles.title}>Exercise library</Text>
      <Text style={styles.subtitle}>
        Conditioning and climbing-specific exercises to build the physical side of your climbing.
      </Text>

      <OptionChips
        options={FILTER_OPTIONS}
        selected={filter}
        onSelect={setFilter}
        testIDPrefix="filter"
      />

      {results.map((ex) => (
        <Card key={ex.id} style={styles.card}>
          <Text style={styles.name}>{ex.name}</Text>
          <Text style={styles.category}>{EXERCISE_CATEGORY_LABELS[ex.category]}</Text>
          <Text style={styles.description}>{ex.description}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  card: { marginTop: spacing.sm },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  category: { color: colors.primary, fontSize: fontSize.sm, marginTop: spacing.xs },
  description: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
