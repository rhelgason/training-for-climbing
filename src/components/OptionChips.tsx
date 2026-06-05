import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

export interface ChipOption<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  /** Selected value(s). For single-select pass the value or null. */
  selected: T | T[] | null;
  onSelect: (value: T) => void;
  testIDPrefix?: string;
}

/** A wrapping row of selectable chips. Works for single- or multi-select. */
export function OptionChips<T extends string>({
  options,
  selected,
  onSelect,
  testIDPrefix,
}: Props<T>) {
  const isSelected = (value: T) =>
    Array.isArray(selected) ? selected.includes(value) : selected === value;

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = isSelected(opt.value);
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={testIDPrefix ? `${testIDPrefix}-${opt.value}` : undefined}
            onPress={() => onSelect(opt.value)}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
});
