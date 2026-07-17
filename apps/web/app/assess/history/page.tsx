'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TRIAD_AREAS, TRIAD_LABELS, trackEvent, type AssessmentRecord } from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { useRepository, useSync } from '@/lib/db/RepositoryProvider';
import { colors, triadColors } from '@/lib/theme';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HistoryScreen() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const router = useRouter();
  const [items, setItems] = useState<AssessmentRecord[] | null>(null);

  useEffect(() => {
    let active = true;
    trackEvent('assessment_viewed_history');
    repo.listAssessments().then((list) => {
      if (active) setItems(list);
    });
    return () => {
      active = false;
    };
  }, [repo, dataVersion]);

  if (items === null) {
    return (
      <>
        <PageHeader title="History" />
        <Screen />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <PageHeader title="History" />
        <Screen>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="leading-6 text-muted">
            No saved assessments yet. Take the assessment to start tracking your progress over time.
          </p>
          <Button onClick={() => router.replace('/assess/new')}>Take the assessment</Button>
        </Screen>
      </>
    );
  }

  const total = (a: AssessmentRecord) => a.mental + a.technical + a.physical;
  const latest = items[0];
  const previous = items[1];
  const delta = previous ? total(latest) - total(previous) : null;

  return (
    <>
      <PageHeader title="History" />
      <Screen>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-base text-muted">
          {items.length} attempt{items.length === 1 ? '' : 's'}
          {delta !== null && (
            <span style={{ color: delta >= 0 ? colors.success : colors.danger }}>
              {'  ·  '}
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs previous
            </span>
          )}
        </p>

        {items.map((item) => (
          <Link key={item.id} href={`/assess/results/${item.id}`}>
            <Card>
              <div className="mb-3 flex justify-between">
                <span className="font-semibold">{formatDate(item.createdAt)}</span>
                <span className="text-sm text-muted">
                  weakest: {TRIAD_LABELS[item.weakestArea]}
                </span>
              </div>
              <div className="flex justify-between">
                {TRIAD_AREAS.map((area) => (
                  <div key={area} className="flex flex-1 flex-col items-center">
                    <span className="text-xl font-bold" style={{ color: triadColors[area] }}>
                      {item[area]}
                    </span>
                    <span className="mt-1 text-sm text-muted">{TRIAD_LABELS[area]}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </Screen>
    </>
  );
}
