'use client';

/**
 * A goal whose deadline has passed asks one question: did you make it?
 *
 * Goals that quietly lapse keep steering the plan toward a date that's gone,
 * and a list of stale goals is what makes people stop setting them. One tap
 * closes it out either way, and an empty goal list asks for the next one.
 */
import Link from 'next/link';
import type { GoalRecord } from '@tfc/core';
import { Card } from './Card';

export type GoalOutcome = 'done' | 'extend' | 'drop';

export function GoalCheckIn({
  goal,
  onDecide,
  busy,
}: {
  /** The overdue goal to ask about, or null when the climber has no active goal. */
  goal: GoalRecord | null;
  onDecide: (goal: GoalRecord, outcome: GoalOutcome) => void;
  busy: boolean;
}) {
  if (!goal) {
    return (
      <Link href="/plan/goals/new">
        <Card interactive className="border-primary">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">
            What&apos;s next?
          </p>
          <p className="mt-1 text-sm leading-5">
            No goal to train toward. Set your next one, and your plan aims at it →
          </p>
        </Card>
      </Link>
    );
  }
  const chip =
    'rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60';
  return (
    <Card className="border-primary">
      <p className="text-sm font-bold uppercase tracking-wide text-primary">Deadline passed</p>
      <p className="mt-1 text-sm leading-5">
        <span className="font-semibold">{goal.title}</span> — did you make it?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(goal, 'done')}
          className={`${chip} border-success/60 text-success`}
        >
          Yes, done ✓
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(goal, 'extend')}
          className={`${chip} text-primary`}
        >
          Extend 4 weeks
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(goal, 'drop')}
          className={`${chip} text-muted`}
        >
          Drop it
        </button>
      </div>
    </Card>
  );
}
