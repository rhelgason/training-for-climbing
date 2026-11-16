'use client';

/**
 * Every logged day, newest first. Moved off Today: the daily screen is for
 * today, and a scroll of past days is something you look up, not something
 * you pass through on the way to training.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ACTIVITY_LABELS, INTENSITY_LABELS, type JournalEntry } from '@tfc/core';
import { Card } from '../../../components/Card';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';
import { useRepository, useSync } from '../../../lib/db/RepositoryProvider';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function TrainingLog() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const [journals, setJournals] = useState<JournalEntry[] | null>(null);

  useEffect(() => {
    let on = true;
    repo.listJournals().then((j) => {
      if (on) setJournals(j);
    });
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  return (
    <>
      <PageHeader title="Training log" />
      <Screen>
        {journals === null ? null : journals.length === 0 ? (
          <p className="text-muted">No days logged yet.</p>
        ) : (
          journals.map((j) => (
            <Link key={j.id} href={`/train/journal/${j.id}`}>
              <Card>
                <div className="flex justify-between">
                  <span className="font-semibold">{formatDate(j.date)}</span>
                  {j.intensity ? (
                    <span className="text-sm text-muted">{INTENSITY_LABELS[j.intensity]}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-primary">
                  {j.activities.length > 0
                    ? j.activities.map((a) => ACTIVITY_LABELS[a]).join(' · ')
                    : 'No activities'}
                </p>
                {j.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{j.summary}</p>
                ) : null}
              </Card>
            </Link>
          ))
        )}
      </Screen>
    </>
  );
}
