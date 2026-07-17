'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DISCIPLINE_LABELS, ENVIRONMENT_LABELS, OUTCOME_LABELS, type ClimbRecord } from '@tfc/core';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Screen } from '../../../components/Screen';
import { useRepository, useSync } from '../../../lib/db/RepositoryProvider';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ClimbsScreen() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const router = useRouter();
  const [climbs, setClimbs] = useState<ClimbRecord[] | null>(null);

  useEffect(() => {
    let on = true;
    repo.listClimbs().then((c) => {
      if (on) setClimbs(c);
    });
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  const remove = async (climb: ClimbRecord) => {
    if (!window.confirm(`Delete climb? ${climb.grade} · ${formatDate(climb.date)}`)) return;
    await repo.deleteClimb(climb.id);
    repo.listClimbs().then(setClimbs);
  };

  if (climbs === null) return <Screen />;

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Climbs</h1>
      <Link href="/progress/climbs/new">
        <Button>+ Log a climb</Button>
      </Link>

      {climbs.length === 0 ? (
        <p className="mt-2 text-muted">No climbs logged yet.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Tap to edit.</p>
          {climbs.map((c) => (
            <Card key={c.id}>
              <button
                type="button"
                onClick={() => router.push(`/progress/climbs/${c.id}/edit`)}
                className="block w-full text-left active:opacity-70"
              >
                <div className="flex flex-row justify-between">
                  <span className="text-lg font-bold text-primary">{c.grade}</span>
                  <span className="text-sm font-semibold">{OUTCOME_LABELS[c.outcome]}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {DISCIPLINE_LABELS[c.discipline]} · {ENVIRONMENT_LABELS[c.environment]} ·{' '}
                  {formatDate(c.date)}
                </p>
                {c.name ? <p className="mt-1">{c.name}</p> : null}
                {c.location ? <p className="mt-1 text-sm text-muted">{c.location}</p> : null}
                {c.notes ? <p className="mt-1 text-sm leading-5 text-muted">{c.notes}</p> : null}
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                className="mt-2 text-sm text-danger active:opacity-70"
              >
                Delete
              </button>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
