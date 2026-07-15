'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { effectiveProfile, now, reassessDue } from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useRepository } from '@/lib/db/RepositoryProvider';

interface LoadState {
  count: number;
  due: boolean;
  reassessWeeks: number;
}

export default function AssessHome() {
  const repo = useRepository();
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([repo.listAssessments(), repo.getProfile()]).then(([list, profile]) => {
      if (!active) return;
      const weeks = effectiveProfile(profile).reassessWeeks;
      setState({ count: list.length, reassessWeeks: weeks, due: reassessDue(list, now(), weeks) });
    });
    return () => {
      active = false;
    };
  }, [repo]);

  const count = state?.count ?? null;
  const due = state?.due ?? false;
  const reassessWeeks = state?.reassessWeeks ?? 0;

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Assess</h1>
      <p className="text-base leading-6 text-muted">
        Rate 30 statements about your recent climbing. Your answers reveal where you stand across
        the performance triad — Mental, Technical, and Physical — and pinpoint specific weaknesses
        to train.
      </p>

      <Card>
        <p className="text-sm text-muted">The performance triad</p>
        <p className="mt-1 text-lg font-semibold">Mental · Technical · Physical</p>
        {count !== null && (
          <p className="mt-2 text-sm text-muted">
            {count === 0 ? 'No attempts yet' : `${count} attempt${count === 1 ? '' : 's'} saved`}
          </p>
        )}
      </Card>

      {due && (
        <Card className="border-warning">
          <p className="text-sm leading-5">
            Time to reassess — it&apos;s been {reassessWeeks}+ weeks. Retaking it keeps your
            training aimed at your current weakest area (the Cycle of Improvement).
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Link href="/assess/new">
          <Button>Take the assessment</Button>
        </Link>
        <Link href="/assess/history">
          <Button variant="secondary">View history</Button>
        </Link>
        <Link href="/assess/fitness">
          <Button variant="secondary">Fitness evaluation</Button>
        </Link>
      </div>
    </Screen>
  );
}
