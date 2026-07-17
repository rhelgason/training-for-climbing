'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FITNESS_TESTS,
  daysSinceLastEvaluation,
  now,
  retestDue,
  trendForTest,
  type BenchmarkRecord,
} from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { useRepository, useSync } from '@/lib/db/RepositoryProvider';

function deltaText(delta: number | null): string {
  if (delta === null || delta === 0) return '';
  return delta > 0 ? `  ▲ ${delta}` : `  ▼ ${Math.abs(delta)}`;
}

function ResultLine({
  benchmarks,
  testId,
  side,
  label,
}: {
  benchmarks: BenchmarkRecord[];
  testId: string;
  side?: 'left' | 'right';
  label?: string;
}) {
  const trend = trendForTest(benchmarks, testId, side);
  return (
    <p className="mt-1">
      {label ? `${label}: ` : ''}
      {trend ? (
        <>
          <span className="font-bold text-primary">{trend.latest.value}</span>
          <span className="text-sm text-success">{deltaText(trend.delta)}</span>
        </>
      ) : (
        <span className="text-sm italic text-muted">not recorded</span>
      )}
    </p>
  );
}

export default function FitnessScreen() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const [benchmarks, setBenchmarks] = useState<BenchmarkRecord[] | null>(null);

  useEffect(() => {
    let on = true;
    repo.listBenchmarks().then((b) => {
      if (on) setBenchmarks(b);
    });
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  if (benchmarks === null) {
    return (
      <>
        <PageHeader title="Fitness evaluation" />
        <Screen />
      </>
    );
  }

  const days = daysSinceLastEvaluation(benchmarks, now());
  const due = retestDue(benchmarks, now());

  return (
    <>
      <PageHeader title="Fitness evaluation" />
      <Screen>
        <p className="text-base leading-6 text-muted">
          A 10-part strength and flexibility benchmark. Take it annually and compare results to
          gauge your conditioning for climbing.
        </p>

        <Card className={due ? 'border-warning' : ''}>
          <p className="text-sm leading-5">
            {days === null
              ? 'No results yet — record your first evaluation to set a baseline.'
              : due
                ? `It’s been ${days} days since your last evaluation — time to retest.`
                : `Last evaluation: ${days} day${days === 1 ? '' : 's'} ago.`}
          </p>
        </Card>

        <Link href="/assess/fitness/new">
          <Button>+ Record evaluation</Button>
        </Link>

        {FITNESS_TESTS.map((test) => (
          <Card key={test.id}>
            <p className="font-bold">{test.name}</p>
            <p className="mt-1 text-sm text-muted">
              {test.metric} ({test.unit})
            </p>
            {test.bilateral ? (
              <div className="mt-1">
                <ResultLine benchmarks={benchmarks} testId={test.id} side="left" label="Left" />
                <ResultLine benchmarks={benchmarks} testId={test.id} side="right" label="Right" />
              </div>
            ) : (
              <ResultLine benchmarks={benchmarks} testId={test.id} />
            )}
          </Card>
        ))}

        <p className="text-sm italic leading-5 text-muted">
          This evaluation is strenuous — warm up fully and rest between tests.
        </p>
      </Screen>
    </>
  );
}
