'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TRIAD_LABELS,
  WEAKNESS_THRESHOLD,
  evaluate,
  groupFlaggedByArea,
  type AssessmentRecord,
} from '@tfc/core';
import { Button } from './Button';
import { Card } from './Card';
import { Screen } from './Screen';
import { TriadBars } from './TriadBars';
import { PageHeader } from './PageHeader';
import { useRepository } from '@/lib/db/RepositoryProvider';

export function AssessResults({ id }: { id: string }) {
  const repo = useRepository();
  const router = useRouter();
  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    repo
      .getAssessment(id)
      .then((r) => {
        if (on) setRecord(r);
      })
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, [repo, id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Results" />
        <Screen className="min-h-[40vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </Screen>
      </>
    );
  }

  if (!record) {
    return (
      <>
        <PageHeader title="Results" />
        <Screen>
          <h1 className="text-2xl font-bold">Result not found</h1>
          <Button onClick={() => router.push('/assess')}>Back</Button>
        </Screen>
      </>
    );
  }

  const result = evaluate(record.responses);
  const weakestLabel = TRIAD_LABELS[result.weakestArea];

  return (
    <>
      <PageHeader title="Results" />
      <Screen>
        <h1 className="text-2xl font-bold">Your results</h1>

        <Card>
          <TriadBars
            scores={result.scores}
            maxPerArea={result.maxPerArea}
            weakestArea={result.weakestArea}
          />
        </Card>

        <Card>
          <p className="text-lg font-semibold">
            {result.balanced
              ? 'Balanced abilities — all three areas are within 5 points.'
              : `Your weakest area is ${weakestLabel}.`}
          </p>
          <p className="mt-2 leading-6 text-muted">
            {result.balanced
              ? 'Keep building all three pillars together as you push your limit.'
              : `Focus your short- and medium-term training on ${weakestLabel.toLowerCase()} skills first.`}
          </p>
        </Card>

        <h2 className="mt-2 text-lg font-bold">
          {result.flagged.length > 0
            ? `Weak spots — rated ${WEAKNESS_THRESHOLD} or lower (${result.flagged.length})`
            : `No statements rated ${WEAKNESS_THRESHOLD} or lower — nicely done!`}
        </h2>
        {result.flagged.length > 0 && (
          <p className="text-sm leading-5 text-muted">
            Each of these is a specific element holding you back. Focus your short- and medium-term
            goals on the five or six lowest-scoring items, and use the exercise library and your
            daily plan to address them.
          </p>
        )}
        {groupFlaggedByArea(result.flagged).map((group) => (
          <div key={group.area}>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">
              {TRIAD_LABELS[group.area]}
            </p>
            {group.items.map(({ question, rating }) => (
              <Card key={question.id} className="mb-2">
                <div className="mb-1 flex justify-end">
                  <span className="text-sm text-warning">rated {rating}/5</span>
                </div>
                <p className="leading-6">{question.prompt}</p>
              </Card>
            ))}
          </div>
        ))}

        <div className="mt-2 flex flex-col gap-3">
          <Button variant="secondary" onClick={() => router.replace('/assess/history')}>
            View history
          </Button>
          <Button onClick={() => router.push('/assess')}>Done</Button>
        </div>
      </Screen>
    </>
  );
}
