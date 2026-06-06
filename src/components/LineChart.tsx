import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { colors, fontSize, spacing } from '../theme';

export interface LineSeries {
  color: string;
  label: string;
  values: number[];
}

interface Props {
  series: LineSeries[];
  /** Y-axis domain. */
  yMin: number;
  yMax: number;
  /** Optional x-axis labels (shown sparsely to avoid crowding). */
  xLabels?: string[];
  height?: number;
}

/**
 * Minimal multi-series line chart over a shared x-axis (point index).
 * Used for progression trends on the dashboard.
 */
export function LineChart({ series, yMin, yMax, xLabels, height = 180 }: Props) {
  const width = Dimensions.get('window').width - spacing.md * 2 - spacing.md * 2;
  const pad = 28;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const count = Math.max(...series.map((s) => s.values.length), 0);

  const x = (i: number) => (count <= 1 ? pad + innerW / 2 : pad + (i / (count - 1)) * innerW);
  const range = yMax - yMin || 1;
  const y = (v: number) => pad + innerH - ((v - yMin) / range) * innerH;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* y gridlines at min / mid / max */}
        {[yMin, (yMin + yMax) / 2, yMax].map((v) => (
          <React.Fragment key={v}>
            <Line
              x1={pad}
              y1={y(v)}
              x2={width - pad}
              y2={y(v)}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText x={2} y={y(v) + 3} fill={colors.textMuted} fontSize={9}>
              {Math.round(v)}
            </SvgText>
          </React.Fragment>
        ))}
        {series.map((s) => (
          <React.Fragment key={s.label}>
            <Polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
            {s.values.map((v, i) => (
              <Circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />
            ))}
          </React.Fragment>
        ))}
        {xLabels?.map((label, i) =>
          // Show first, last, and middle labels to avoid crowding.
          i === 0 || i === xLabels.length - 1 || i === Math.floor(xLabels.length / 2) ? (
            <SvgText
              key={`${label}-${i}`}
              x={x(i)}
              y={height - 6}
              fill={colors.textMuted}
              fontSize={9}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ) : null,
        )}
      </Svg>
      <View style={styles.legend}>
        {series.map((s) => (
          <Text key={s.label} style={[styles.legendItem, { color: s.color }]}>
            ● {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  legendItem: { fontSize: fontSize.sm, fontWeight: '600' },
});
