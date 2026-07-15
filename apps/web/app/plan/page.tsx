'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { activeGoals, type GoalRecord } from '@tfc/core';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useRepository } from '@/lib/db/RepositoryProvider';

export default function PlanHome() {
  const repo = useRepository();
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    let on = true;
    repo.listGoals().then((g: GoalRecord[]) => {
      if (on) setActiveCount(activeGoals(g).length);
    });
    return () => {
      on = false;
    };
  }, [repo]);

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Plan</h1>
      <p className="text-base leading-6 text-muted">
        Turn your assessment into action. Set goals across three time horizons and design a session
        that trains the right things in the right order.
      </p>

      <Link href="/plan/goals" className="block">
        <Card>
          <h2 className="text-lg font-semibold">Goals</h2>
          <p className="mt-1 text-base leading-6 text-muted">
            Short, medium, and long-term goals — each with a mission and what you&apos;ll give up.
          </p>
          {activeCount !== null && (
            <p className="mt-2 text-sm font-semibold text-primary">
              {activeCount === 0 ? 'No active goals yet' : `${activeCount} active`}
            </p>
          )}
        </Card>
      </Link>

      <Link href="/plan/program" className="block">
        <Card>
          <h2 className="text-lg font-semibold">Program builder</h2>
          <p className="mt-1 text-base leading-6 text-muted">
            Pick your ability tier and focus areas to get an ordered session plan and rest guidance.
          </p>
        </Card>
      </Link>

      <Link href="/plan/macrocycle" className="block">
        <Card>
          <h2 className="text-lg font-semibold">Macrocycle</h2>
          <p className="mt-1 text-base leading-6 text-muted">
            Plan your training year in blocks (base, power, peak, rest) and track climbing days
            against each.
          </p>
        </Card>
      </Link>
    </Screen>
  );
}
