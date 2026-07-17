'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  currentPeriod,
  formatYmd,
  now,
  trainingDates,
  trainingDaysInRange,
  type MacrocyclePeriodRecord,
} from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useRepository, useSync } from '@/lib/db/RepositoryProvider';

interface LoadState {
  periods: MacrocyclePeriodRecord[];
  trainingDates: number[];
}

export default function MacrocycleScreen() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([repo.listMacrocyclePeriods(), repo.listJournals(), repo.listClimbs()]).then(
      ([periods, journals, climbs]) => {
        if (on) setState({ periods, trainingDates: trainingDates(journals, climbs) });
      },
    );
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  if (state === null) return <Screen />;
  const { periods, trainingDates: dates } = state;
  const current = currentPeriod(periods, now());

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Macrocycle</h1>
      <p className="text-base leading-6 text-muted">
        Plan your training year as a sequence of blocks. Each shows the climbing days you logged
        within it, so you can compare plan vs. reality.
      </p>

      <Link href="/plan/macrocycle/new" className="block">
        <Button>+ Add a period</Button>
      </Link>

      {periods.length === 0 && (
        <p className="text-base leading-6 text-muted">
          No periods yet. Add blocks like “Winter base”, “Spring power”, or a peaking phase before a
          trip.
        </p>
      )}

      {periods.map((p) => {
        const isCurrent = current?.id === p.id;
        const days = trainingDaysInRange(dates, p.startDate, p.endDate);
        return (
          <Link key={p.id} href={`/plan/macrocycle/${p.id}/edit`} className="block">
            <Card className={isCurrent ? 'border-primary' : ''}>
              <div className="flex items-center justify-between">
                <span className="font-bold">{p.label}</span>
                {isCurrent && <span className="text-sm font-bold text-primary">current</span>}
              </div>
              <p className="mt-1 text-sm text-muted">
                {formatYmd(p.startDate)} → {formatYmd(p.endDate)}
              </p>
              {p.focus ? (
                <p className="mt-1 text-sm leading-5 text-muted">Focus: {p.focus}</p>
              ) : null}
              {p.objective ? (
                <p className="mt-1 text-sm leading-5 text-muted">Objective: {p.objective}</p>
              ) : null}
              {p.notes ? <p className="mt-1 text-sm leading-5 text-muted">{p.notes}</p> : null}
              <p className="mt-2 text-sm font-semibold text-primary">
                {days} training day{days === 1 ? '' : 's'} logged
              </p>
            </Card>
          </Link>
        );
      })}
    </Screen>
  );
}
