'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GOAL_HORIZON_LABELS,
  HORIZON_ORDER,
  TRIAD_LABELS,
  groupGoalsByHorizon,
  isOverdue,
  now,
  trackEvent,
  type GoalRecord,
} from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useRepository, useSync } from '@/lib/db/RepositoryProvider';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GoalsScreen() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const [goals, setGoals] = useState<GoalRecord[] | null>(null);

  useEffect(() => {
    let on = true;
    repo.listGoals().then((g) => {
      if (on) setGoals(g);
    });
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  const refresh = () => repo.listGoals().then(setGoals);

  const toggleDone = async (goal: GoalRecord) => {
    if (goal.status === 'done') {
      await repo.updateGoal(goal.id, { status: 'active', completedAt: undefined });
    } else {
      await repo.updateGoal(goal.id, { status: 'done', completedAt: now() });
      trackEvent('goal_completed', { horizon: goal.horizon });
    }
    refresh();
  };

  const remove = async (goal: GoalRecord) => {
    if (!window.confirm(`Delete goal?\n\n${goal.title}`)) return;
    await repo.deleteGoal(goal.id);
    trackEvent('goal_deleted', { horizon: goal.horizon });
    refresh();
  };

  if (goals === null) return <Screen />;

  const grouped = groupGoalsByHorizon(goals);
  const currentTime = now();

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Goals</h1>
      <Link href="/plan/goals/new" className="block">
        <Button>+ Add a goal</Button>
      </Link>

      {goals.length === 0 && (
        <p className="text-base leading-6 text-muted">
          No goals yet. Add your first — short-term for today, medium-term for the season, long-term
          for your dream send.
        </p>
      )}

      {HORIZON_ORDER.map((horizon) => {
        const list = grouped[horizon];
        if (list.length === 0) return null;
        return (
          <div key={horizon}>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              {GOAL_HORIZON_LABELS[horizon]}
            </p>
            {list.map((goal) => (
              <Card key={goal.id} className="mb-2">
                <Link href={`/plan/goals/${goal.id}/edit`} className="block">
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex-1 font-semibold ${
                        goal.status === 'done' ? 'text-muted line-through' : ''
                      }`}
                    >
                      {goal.title}
                    </span>
                    {goal.triadArea && (
                      <span className="ml-2 text-sm font-bold text-primary">
                        {TRIAD_LABELS[goal.triadArea]}
                      </span>
                    )}
                  </div>
                  {goal.mission ? (
                    <p className="mt-1 text-sm leading-5 text-muted">Mission: {goal.mission}</p>
                  ) : null}
                  {goal.sacrifice ? (
                    <p className="mt-1 text-sm leading-5 text-muted">Giving up: {goal.sacrifice}</p>
                  ) : null}
                  {goal.targetDate ? (
                    <p
                      className={`mt-1 text-sm leading-5 ${
                        isOverdue(goal, currentTime) ? 'text-danger' : 'text-muted'
                      }`}
                    >
                      Due {formatDate(goal.targetDate)}
                      {isOverdue(goal, currentTime) ? ' · overdue' : ''}
                    </p>
                  ) : null}
                </Link>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => toggleDone(goal)}>
                    {goal.status === 'done' ? 'Reactivate' : 'Mark done'}
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => remove(goal)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        );
      })}
    </Screen>
  );
}
