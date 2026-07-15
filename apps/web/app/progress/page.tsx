'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  OUTCOME_LABELS,
  TRIAD_LABELS,
  FITNESS_TESTS,
  effectiveProfile,
  now,
  trainingDates,
  reassessDue,
  trendForTest,
  countInLastDays,
  firstTryRate,
  hardestSend,
  monthlyCounts,
  sendPyramid,
  sendRate,
  triadSeries,
  weeklyCounts,
  type ClimbDiscipline,
  type AssessmentRecord,
  type BenchmarkRecord,
  type ClimbRecord,
  type JournalEntry,
  type ProfileRecord,
  type PyramidRow,
} from '@tfc/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LineChart } from '../../components/LineChart';
import { Screen } from '../../components/Screen';
import { useRepository } from '../../lib/db/RepositoryProvider';
import { colors, triadColors } from '../../lib/theme';

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
    <div className="flex flex-col gap-2">
      {rows.slice(0, 6).map((r) => (
        <div key={r.grade} className="flex flex-row items-center gap-2">
          <span className="w-11 text-sm font-semibold">{r.grade}</span>
          <div className="h-3.5 flex-1 overflow-hidden rounded-md bg-surface-alt">
            <div
              className="h-full rounded-md bg-primary"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="w-5 text-right text-sm text-muted">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardScreen() {
  const repo = useRepository();
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
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
  }, [repo]);

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
      <h1 className="text-2xl font-bold">Progress</h1>

      <div className="flex flex-col gap-2">
        <Link href="/progress/climbs/new">
          <Button>+ Log a climb</Button>
        </Link>
        <Link href="/progress/climbs">
          <Button variant="secondary">All climbs</Button>
        </Link>
      </div>

      {showReassessNudge && (
        <Card className="border-warning">
          <p className="text-sm leading-5">
            It&apos;s been {reassessWeeks}+ weeks since your last self-assessment. Retake it in the
            Assess tab to keep your training aimed at the right weakness.
          </p>
        </Card>
      )}

      <h2 className="mt-2 text-lg font-bold">Personal bests</h2>
      {bests.length === 0 ? (
        <p className="text-muted">Log a send to see your hardest grades here.</p>
      ) : (
        <div className="flex flex-row flex-wrap gap-2">
          {bests.map(({ discipline, climb }) => (
            <Card key={discipline} className="flex min-w-[100px] grow flex-col items-center">
              <span className="text-2xl font-bold text-primary">{climb.grade}</span>
              <span className="mt-1 text-sm font-semibold">{DISCIPLINE_LABELS[discipline]}</span>
              <span className="mt-1 text-sm text-muted">
                {OUTCOME_LABELS[climb.outcome]} · {formatDate(climb.date)}
              </span>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-2 text-lg font-bold">Last 30 days</h2>
      <Card className="flex flex-row justify-between">
        <div className="flex flex-1 flex-col items-center">
          <span className="text-xl font-bold">
            {countInLastDays(
              climbs.map((c) => c.date),
              nowMs,
              30,
            )}
          </span>
          <span className="mt-1 text-center text-sm text-muted">climbs</span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <span className="text-xl font-bold">{countInLastDays(trainDates, nowMs, 30)}</span>
          <span className="mt-1 text-center text-sm text-muted">training days</span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <span className="text-xl font-bold">{climbs.length ? pct(sendRate(climbs)) : '—'}</span>
          <span className="mt-1 text-center text-sm text-muted">send rate</span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <span className="text-xl font-bold">
            {climbs.length ? pct(firstTryRate(climbs)) : '—'}
          </span>
          <span className="mt-1 text-center text-sm text-muted">onsight/flash</span>
        </div>
      </Card>

      {climbs.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-bold">Climbs per month</h2>
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
          <h2 className="mt-2 text-lg font-bold">Training consistency</h2>
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
          <h2 className="mt-2 text-lg font-bold">Fitness benchmarks</h2>
          {benchmarkTrends.map(({ test, trend, history }) => (
            <Card key={test.id}>
              <div className="flex flex-row justify-between">
                <span className="font-semibold">{test.name}</span>
                <span>
                  {trend!.latest.value} {test.unit}
                  {trend!.delta !== null && trend!.delta !== 0 ? (
                    <span style={{ color: trend!.delta > 0 ? colors.success : colors.danger }}>
                      {trend!.delta > 0 ? `  ▲ ${trend!.delta}` : `  ▼ ${Math.abs(trend!.delta)}`}
                    </span>
                  ) : null}
                </span>
              </div>
              {history.length >= 2 && (
                <div className="mt-2">
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
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {boulderPyramid.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-bold">Boulder pyramid</h2>
          <Card>
            <Pyramid rows={boulderPyramid} />
          </Card>
        </>
      )}

      {leadPyramid.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-bold">Lead pyramid</h2>
          <Card>
            <Pyramid rows={leadPyramid} />
          </Card>
        </>
      )}

      <h2 className="mt-2 text-lg font-bold">Assessment triad</h2>
      {latestTriad ? (
        <Card>
          {(['mental', 'technical', 'physical'] as const).map((area) => {
            const delta = prevTriad ? latestTriad[area] - prevTriad[area] : null;
            return (
              <div key={area} className="mb-1 flex flex-row justify-between">
                <span className="font-semibold" style={{ color: triadColors[area] }}>
                  {TRIAD_LABELS[area]}
                </span>
                <span>
                  {latestTriad[area]}/50
                  {delta !== null && delta !== 0 ? (
                    <span style={{ color: delta > 0 ? colors.success : colors.danger }}>
                      {delta > 0 ? `  ▲ ${delta}` : `  ▼ ${Math.abs(delta)}`}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
          <p className="mt-2 text-sm text-muted">
            {triad.length} assessment{triad.length === 1 ? '' : 's'} on record
          </p>
          {triad.length >= 2 && (
            <div className="mt-4">
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
            </div>
          )}
        </Card>
      ) : (
        <p className="text-muted">Take the self-assessment to track your triad over time.</p>
      )}

      <h2 className="mt-2 text-lg font-bold">Recent climbs</h2>
      {climbs.length === 0 ? (
        <p className="text-muted">Nothing logged yet.</p>
      ) : (
        climbs.slice(0, 5).map((c) => (
          <Card key={c.id}>
            <div className="flex flex-row justify-between">
              <span className="font-bold text-primary">{c.grade}</span>
              <span className="text-sm font-semibold">{OUTCOME_LABELS[c.outcome]}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {DISCIPLINE_LABELS[c.discipline]} · {formatDate(c.date)}
              {c.name ? ` · ${c.name}` : ''}
            </p>
          </Card>
        ))
      )}
    </Screen>
  );
}
