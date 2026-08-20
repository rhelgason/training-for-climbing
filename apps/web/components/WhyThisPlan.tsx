'use client';

/**
 * The "why" behind today's plan, collapsed by default.
 *
 * A plan you can't interrogate is a plan you stop trusting the first time it
 * tells you to rest on a day you feel great. This shows the actual working:
 * what the last few days applied, and every focus that was ruled in or out with
 * the reason — the same verdicts the AI coach is bound by.
 */
import { useState } from 'react';
import type { Microcycle } from '@tfc/core';
import { Card } from './Card';

interface Props {
  microcycle: Microcycle | null;
  because: string;
}

export function WhyThisPlan({ microcycle, because }: Props) {
  const [open, setOpen] = useState(false);
  if (!microcycle) return null;

  const blocked = microcycle.verdicts.filter((v) => v.status === 'blocked');
  const available = microcycle.verdicts.filter((v) => v.status !== 'blocked');

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Why this plan</p>
          {!open && because ? <p className="truncate text-sm">{because}</p> : null}
        </div>
        <span className="shrink-0 text-sm font-semibold text-primary">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          {because ? (
            <div>
              <p className="text-sm font-semibold text-muted">Your recent training</p>
              <p className="mt-1 text-sm leading-5">{because}</p>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-semibold text-muted">This week</p>
            <p className="mt-1 text-sm leading-5">
              {microcycle.trainingDaysThisWeek} training{' '}
              {microcycle.trainingDaysThisWeek === 1 ? 'day' : 'days'} in the last 7
              {microcycle.hardDaysInARow > 0
                ? ` · ${microcycle.hardDaysInARow} hard ${
                    microcycle.hardDaysInARow === 1 ? 'day' : 'days'
                  } in a row`
                : ''}
              .
            </p>
          </div>

          {available.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted">On the table today</p>
              {available.map((v) => (
                <p key={v.focus} className="mt-1 text-sm leading-5">
                  <span className="font-semibold">{v.label}</span> — {v.reason}
                </p>
              ))}
            </div>
          )}

          {blocked.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted">Not today</p>
              {blocked.map((v) => (
                <p key={v.focus} className="mt-1 text-sm leading-5 text-muted">
                  <span className="font-semibold">{v.label}</span> — {v.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
