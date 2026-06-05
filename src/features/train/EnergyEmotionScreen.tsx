import React, { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import type { CheckinRecord } from '../../db/types';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import type { TrainStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing, triadColors } from '../../theme';
import { EMOTION_MAX, EMOTION_MIN, ENERGY_MAX, quadrantOf, readingsForDay } from './energyEmotion';

type Props = NativeStackScreenProps<TrainStackParamList, 'EnergyEmotion'>;

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const ENERGY_COLOR = triadColors.physical;
const EMOTION_COLOR = triadColors.mental;

function DayChart({ readings }: { readings: CheckinRecord[] }) {
  const width = Dimensions.get('window').width - spacing.md * 2 - spacing.md * 2;
  const height = 180;
  const pad = 24;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i: number) =>
    readings.length <= 1 ? pad + innerW / 2 : pad + (i / (readings.length - 1)) * innerW;
  const yEnergy = (v: number) => pad + innerH - (v / ENERGY_MAX) * innerH;
  const yEmotion = (v: number) =>
    pad + innerH - ((v - EMOTION_MIN) / (EMOTION_MAX - EMOTION_MIN)) * innerH;

  const energyPts = readings.map((r, i) => `${x(i)},${yEnergy(r.energy)}`).join(' ');
  const emotionPts = readings.map((r, i) => `${x(i)},${yEmotion(r.emotion)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {/* midline = high/low energy boundary (energy 5) */}
      <Line
        x1={pad}
        y1={yEnergy(5)}
        x2={width - pad}
        y2={yEnergy(5)}
        stroke={colors.border}
        strokeWidth={1}
      />
      <Polyline points={energyPts} fill="none" stroke={ENERGY_COLOR} strokeWidth={2} />
      <Polyline points={emotionPts} fill="none" stroke={EMOTION_COLOR} strokeWidth={2} />
      {readings.map((r, i) => (
        <Circle key={`e${r.id}`} cx={x(i)} cy={yEnergy(r.energy)} r={3} fill={ENERGY_COLOR} />
      ))}
      {readings.map((r, i) => (
        <Circle key={`m${r.id}`} cx={x(i)} cy={yEmotion(r.emotion)} r={3} fill={EMOTION_COLOR} />
      ))}
      <SvgText x={pad} y={12} fill={colors.textMuted} fontSize={10}>
        energy / emotion over today
      </SvgText>
    </Svg>
  );
}

export function EnergyEmotionScreen({ navigation }: Props) {
  const repo = useRepository();
  const [checkins, setCheckins] = useState<CheckinRecord[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      repo.listCheckins().then((c) => {
        if (on) setCheckins(c);
      });
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (checkins === null) return <Screen />;

  const today = readingsForDay(checkins, now());

  return (
    <Screen>
      <Text style={styles.title}>Energy &amp; emotion</Text>
      <Text style={styles.subtitle}>
        Log your physical energy and mind-set through the day to spot patterns and triggers.
      </Text>

      <Button
        label="+ Log check-in"
        onPress={() => navigation.navigate('CheckinForm')}
        style={styles.add}
      />

      <Text style={styles.sectionTitle}>Today</Text>
      {today.length === 0 ? (
        <Text style={styles.empty}>No check-ins today yet.</Text>
      ) : (
        <>
          <Card style={styles.chartCard}>
            <DayChart readings={today} />
            <View style={styles.legend}>
              <Text style={[styles.legendItem, { color: ENERGY_COLOR }]}>● energy</Text>
              <Text style={[styles.legendItem, { color: EMOTION_COLOR }]}>● emotion</Text>
            </View>
          </Card>
          {today
            .slice()
            .reverse()
            .map((c) => {
              const q = quadrantOf(c.energy, c.emotion);
              return (
                <Card key={c.id} style={styles.reading}>
                  <View style={styles.readingHeader}>
                    <Text style={styles.readingTime}>{formatTime(c.time)}</Text>
                    <Text style={[styles.readingQuadrant, q.optimal && styles.optimal]}>
                      {q.id} · {q.label}
                    </Text>
                  </View>
                  <Text style={styles.readingValues}>
                    energy {c.energy}/10 · emotion {c.emotion > 0 ? `+${c.emotion}` : c.emotion}
                  </Text>
                  {c.note ? <Text style={styles.readingNote}>{c.note}</Text> : null}
                </Card>
              );
            })}
        </>
      )}
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
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: { color: colors.textMuted, fontSize: fontSize.md },
  chartCard: { marginBottom: spacing.md, alignItems: 'center' },
  legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { fontSize: fontSize.sm, fontWeight: '600' },
  reading: { marginBottom: spacing.sm },
  readingHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  readingTime: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  readingQuadrant: { color: colors.textMuted, fontSize: fontSize.sm },
  optimal: { color: colors.success, fontWeight: '700' },
  readingValues: { color: colors.primary, fontSize: fontSize.sm, marginTop: spacing.xs },
  readingNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
