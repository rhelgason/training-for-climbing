'use client';

/**
 * Pick any workout and run it — for days the plan didn't call it, or for
 * logging something done off-script. Each row shows today's number so the
 * choice is informed.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  WORKOUTS,
  dayStartMs,
  now,
  progressWorkout,
  sessionFocus,
  type SessionFocusId,
  type WorkoutTarget,
} from '@tfc/core';
import { Card } from '../../../components/Card';
import { PageHeader } from '../../../components/PageHeader';
import { useRepository } from '../../../lib/db/RepositoryProvider';

const ORDER: SessionFocusId[] = ['maxStrength', 'power', 'powerEndurance', 'enduranceAerobic'];

export default function PickWorkout() {
  const repo = useRepository();
  const [targets, setTargets] = useState<Record<string, WorkoutTarget> | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([repo.listExerciseLogs(), repo.listBenchmarks()]).then(([logs, benchmarks]) => {
      if (!on) return;
      const prior = logs.filter((l) => l.date < dayStartMs(now()));
      setTargets(
        Object.fromEntries(
          WORKOUTS.map((w) => [
            w.id,
            progressWorkout(w, { logs: prior, benchmarks, nowMs: now() }),
          ]),
        ),
      );
    });
    return () => {
      on = false;
    };
  }, [repo]);

  return (
    <>
      <PageHeader title="Run a workout" />
      <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
        {ORDER.map((focus) => (
          <section key={focus} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              {sessionFocus(focus).label}
            </h2>
            {WORKOUTS.filter((w) => w.focus === focus).map((w) => {
              const t = targets?.[w.id];
              return (
                <Link key={w.id} href={`/train/session/${w.id}`}>
                  <Card interactive className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{w.name}</p>
                        <p className="truncate text-sm text-muted">
                          {t
                            ? t.kind === 'test'
                              ? 'Not logged yet — find your number'
                              : t.label
                            : ' '}
                        </p>
                      </div>
                      {t && t.kind === 'progress' ? (
                        <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                          ↑ step
                        </span>
                      ) : t?.stalled ? (
                        <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">
                          stalled
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
