import {
  type AssessmentRecord,
  type BenchmarkRecord,
  type ClimbDiscipline,
  type ClimbRecord,
  countInLastDays,
  DISCIPLINE_LABELS,
  DISCIPLINES,
  effectiveProfile,
  firstTryRate,
  FITNESS_TESTS,
  hardestSend,
  type JournalEntry,
  monthlyCounts,
  OUTCOME_LABELS,
  type ProfileRecord,
  type PyramidRow,
  reassessDue,
  sendPyramid,
  sendRate,
  trainingDates,
  trendForTest,
  TRIAD_LABELS,
  triadSeries,
  weeklyCounts,
} from '@tfc/core';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LineChart } from '../../components/LineChart';
import { Screen } from '../../components/Screen';
import { now } from '../../lib/clock';
import { useRepository } from '../../providers/RepositoryProvider';
import type { ProgressStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing, triadColors } from '../../theme';

type Props = NativeStackScreenProps<ProgressStackParamList, 'Dashboard'>;

interface LoadState {
  climbs: ClimbRecord[];
  journals: JournalEntry[];
  assessments: AssessmentRecord[];
  benchmarks: BenchmarkRecord[];
  profile: ProfileRecord | null;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Pyramid({ rows }: { rows: PyramidRow[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <View style={styles.pyramid}>
      {rows.slice(0, 6).map((r) => (
        <View key={r.grade} style={styles.pyramidRow}>
          <Text style={styles.pyramidGrade}>{r.grade}</Text>
          <View style={styles.pyramidTrack}>
            <View style={[styles.pyramidFill, { width: `${(r.count / max) * 100}%` }]} />
          </View>
          <Text style={styles.pyramidCount}>{r.count}</Text>
        </View>
      ))}
    </View>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const repo = useRepository();
  const [state, setState] = useState<LoadState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all([
        repo.listClimbs(),
        repo.listJournals(),
        repo.listAssessments(),
        repo.listBenchmarks(),
        repo.getProfile(),
      ]).then(([climbs, journals, assessments, benchmarks, profile]) => {
        if (on) setState({ climbs, journals, assessments, benchmarks, profile });
      });
      return () => {
        on = false;
      };
    }, [repo]),
  );

  if (state === null) return <Screen />;
  const { climbs, journals, assessments, benchmarks, profile } = state;
  const nowMs = now();
  const trainDates = trainingDates(journals, climbs);
  const { reassessWeeks } = effectiveProfile(profile);
  const showReassessNudge = reassessDue(assessments, nowMs, reassessWeeks);

  const trainingByWeek = weeklyCounts(trainDates, nowMs, 8);
  const maxWeekly = Math.max(...trainingByWeek.map((w) => w.count), 1);

  // Fitness tests with at least one recorded benchmark (non-bilateral side).
  const benchmarkTrends = FITNESS_TESTS.map((t) => ({
    test: t,
    trend: trendForTest(benchmarks, t.id),
    history: benchmarks
      .filter((b) => b.testId === t.id && b.side === undefined)
      .sort((a, b) => a.date - b.date),
  })).filter((x) => x.trend !== null);

  const bests = DISCIPLINES.map((d) => ({ discipline: d, climb: hardestSend(climbs, d) })).filter(
    (b): b is { discipline: ClimbDiscipline; climb: ClimbRecord } => b.climb !== null,
  );

  const triad = triadSeries(assessments);
  const latestTriad = triad[triad.length - 1];
  const prevTriad = triad[triad.length - 2];

  const boulderPyramid = sendPyramid(climbs, 'boulder');
  const leadPyramid = sendPyramid(climbs, 'lead');

  const climbsByMonth = monthlyCounts(
    climbs.map((c) => c.date),
    nowMs,
    6,
  );
  const maxMonthly = Math.max(...climbsByMonth.map((m) => m.count), 1);

  return (
    <Screen>
      <Text style={styles.title}>Progress</Text>

      <View style={styles.actions}>
        <Button label="+ Log a climb" onPress={() => navigation.navigate('ClimbForm')} />
        <Button
          label="All climbs"
          variant="secondary"
          onPress={() => navigation.navigate('Climbs')}
          style={styles.secondaryAction}
        />
      </View>

      {showReassessNudge && (
        <Card style={styles.nudge}>
          <Text style={styles.nudgeText}>
            It&apos;s been {reassessWeeks}+ weeks since your last self-assessment. Retake it in the
            Assess tab to keep your training aimed at the right weakness.
          </Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Personal bests</Text>
      {bests.length === 0 ? (
        <Text style={styles.empty}>Log a send to see your hardest grades here.</Text>
      ) : (
        <View style={styles.bests}>
          {bests.map(({ discipline, climb }) => (
            <Card key={discipline} style={styles.bestCard}>
              <Text style={styles.bestGrade}>{climb.grade}</Text>
              <Text style={styles.bestLabel}>{DISCIPLINE_LABELS[discipline]}</Text>
              <Text style={styles.bestMeta}>
                {OUTCOME_LABELS[climb.outcome]} · {formatDate(climb.date)}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Last 30 days</Text>
      <Card style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {countInLastDays(
              climbs.map((c) => c.date),
              nowMs,
              30,
            )}
          </Text>
          <Text style={styles.statLabel}>climbs</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{countInLastDays(trainDates, nowMs, 30)}</Text>
          <Text style={styles.statLabel}>training days</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{climbs.length ? pct(sendRate(climbs)) : '—'}</Text>
          <Text style={styles.statLabel}>send rate</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{climbs.length ? pct(firstTryRate(climbs)) : '—'}</Text>
          <Text style={styles.statLabel}>onsight/flash</Text>
        </View>
      </Card>

      {climbs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Climbs per month</Text>
          <Card>
            <LineChart
              series={[
                {
                  color: colors.primary,
                  label: 'climbs',
                  values: climbsByMonth.map((m) => m.count),
                },
              ]}
              xLabels={climbsByMonth.map((m) => m.label)}
              yMin={0}
              yMax={maxMonthly}
            />
          </Card>
        </>
      )}

      {trainDates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Training consistency</Text>
          <Card>
            <LineChart
              series={[
                {
                  color: colors.success,
                  label: 'days/week',
                  values: trainingByWeek.map((w) => w.count),
                },
              ]}
              xLabels={trainingByWeek.map((w) => w.label)}
              yMin={0}
              yMax={maxWeekly}
            />
          </Card>
        </>
      )}

      {benchmarkTrends.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Fitness benchmarks</Text>
          {benchmarkTrends.map(({ test, trend, history }) => (
            <Card key={test.id} style={styles.benchCard}>
              <View style={styles.row}>
                <Text style={styles.benchName}>{test.name}</Text>
                <Text style={styles.benchValue}>
                  {trend!.latest.value} {test.unit}
                  {trend!.delta !== null && trend!.delta !== 0 ? (
                    <Text style={{ color: trend!.delta > 0 ? colors.success : colors.danger }}>
                      {trend!.delta > 0 ? `  ▲ ${trend!.delta}` : `  ▼ ${Math.abs(trend!.delta)}`}
                    </Text>
                  ) : null}
                </Text>
              </View>
              {history.length >= 2 && (
                <View style={styles.benchChart}>
                  <LineChart
                    series={[
                      {
                        color: colors.primary,
                        label: test.unit,
                        values: history.map((b) => b.value),
                      },
                    ]}
                    xLabels={history.map((b) => formatDate(b.date))}
                    yMin={Math.min(...history.map((b) => b.value), 0)}
                    yMax={Math.max(...history.map((b) => b.value), 1)}
                  />
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      {boulderPyramid.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Boulder pyramid</Text>
          <Card>
            <Pyramid rows={boulderPyramid} />
          </Card>
        </>
      )}

      {leadPyramid.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Lead pyramid</Text>
          <Card>
            <Pyramid rows={leadPyramid} />
          </Card>
        </>
      )}

      <Text style={styles.sectionTitle}>Assessment triad</Text>
      {latestTriad ? (
        <Card style={styles.triadCard}>
          {(['mental', 'technical', 'physical'] as const).map((area) => {
            const delta = prevTriad ? latestTriad[area] - prevTriad[area] : null;
            return (
              <View key={area} style={styles.triadRow}>
                <Text style={[styles.triadLabel, { color: triadColors[area] }]}>
                  {TRIAD_LABELS[area]}
                </Text>
                <Text style={styles.triadValue}>
                  {latestTriad[area]}/50
                  {delta !== null && delta !== 0 ? (
                    <Text style={{ color: delta > 0 ? colors.success : colors.danger }}>
                      {delta > 0 ? `  ▲ ${delta}` : `  ▼ ${Math.abs(delta)}`}
                    </Text>
                  ) : null}
                </Text>
              </View>
            );
          })}
          <Text style={styles.triadMeta}>
            {triad.length} assessment{triad.length === 1 ? '' : 's'} on record
          </Text>
          {triad.length >= 2 && (
            <View style={styles.triadChart}>
              <LineChart
                yMin={0}
                yMax={50}
                series={[
                  {
                    color: triadColors.mental,
                    label: 'Mental',
                    values: triad.map((p) => p.mental),
                  },
                  {
                    color: triadColors.technical,
                    label: 'Technical',
                    values: triad.map((p) => p.technical),
                  },
                  {
                    color: triadColors.physical,
                    label: 'Physical',
                    values: triad.map((p) => p.physical),
                  },
                ]}
              />
            </View>
          )}
        </Card>
      ) : (
        <Text style={styles.empty}>Take the self-assessment to track your triad over time.</Text>
      )}

      <Text style={styles.sectionTitle}>Recent climbs</Text>
      {climbs.length === 0 ? (
        <Text style={styles.empty}>Nothing logged yet.</Text>
      ) : (
        climbs.slice(0, 5).map((c) => (
          <Card key={c.id} style={styles.recent}>
            <View style={styles.row}>
              <Text style={styles.recentGrade}>{c.grade}</Text>
              <Text style={styles.recentOutcome}>{OUTCOME_LABELS[c.outcome]}</Text>
            </View>
            <Text style={styles.recentMeta}>
              {DISCIPLINE_LABELS[c.discipline]} · {formatDate(c.date)}
              {c.name ? ` · ${c.name}` : ''}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  secondaryAction: {},
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: { color: colors.textMuted, fontSize: fontSize.md },
  nudge: { marginTop: spacing.md, borderColor: colors.warning },
  nudgeText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  benchCard: { marginBottom: spacing.sm },
  benchName: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  benchValue: { color: colors.text, fontSize: fontSize.md },
  benchChart: { marginTop: spacing.sm },
  bests: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bestCard: { flexGrow: 1, minWidth: 100, alignItems: 'center' },
  bestGrade: { color: colors.primary, fontSize: fontSize.xxl, fontWeight: '700' },
  bestLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  bestMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  pyramid: { gap: spacing.sm },
  pyramidRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pyramidGrade: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', width: 44 },
  pyramidTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pyramidFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.sm },
  pyramidCount: { color: colors.textMuted, fontSize: fontSize.sm, width: 20, textAlign: 'right' },
  triadCard: {},
  triadChart: { marginTop: spacing.md },
  triadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  triadLabel: { fontSize: fontSize.md, fontWeight: '600' },
  triadValue: { color: colors.text, fontSize: fontSize.md },
  triadMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  recent: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  recentGrade: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  recentOutcome: { color: colors.text, fontSize: fontSize.sm },
  recentMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
});
