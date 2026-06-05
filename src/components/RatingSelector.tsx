import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius } from '../theme';

interface Props {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  testIDPrefix?: string;
}

/** A 0..5 rating selector rendered as a row of selectable chips. */
export function RatingSelector({ value, onChange, min = 0, max = 5, testIDPrefix }: Props) {
  const options = [];
  for (let i = min; i <= max; i += 1) options.push(i);
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={testIDPrefix ? `${testIDPrefix}-${opt}` : undefined}
            onPress={() => onChange(opt)}
            style={[styles.chip, selected ? styles.chipSelected : null]}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
});
