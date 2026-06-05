import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TRIAD_AREAS, TRIAD_LABELS } from '../content/types';
import type { TriadScores } from '../features/assess/scoring';
import { colors, fontSize, radius, spacing, triadColors } from '../theme';

interface Props {
  scores: TriadScores;
  maxPerArea: TriadScores;
  weakestArea?: string;
}

/** Horizontal bar chart of the three triad scores (no external chart dep). */
export function TriadBars({ scores, maxPerArea, weakestArea }: Props) {
  return (
    <View>
      {TRIAD_AREAS.map((area) => {
        const value = scores[area];
        const max = maxPerArea[area] || 1;
        const pct = Math.max(0, Math.min(100, (value / max) * 100));
        const isWeakest = area === weakestArea;
        return (
          <View key={area} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                {TRIAD_LABELS[area]}
                {isWeakest ? '  ·  weakest' : ''}
              </Text>
              <Text style={styles.value}>
                {value}/{max}
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: triadColors[area] },
                  isWeakest ? styles.weakestFill : null,
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  value: { color: colors.textMuted, fontSize: fontSize.sm },
  track: {
    height: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.sm },
  weakestFill: { borderWidth: 1, borderColor: colors.warning },
});
