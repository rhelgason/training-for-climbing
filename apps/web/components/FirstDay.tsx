'use client';

import Link from 'next/link';
import { Card } from './Card';

/**
 * How to use Today, shown until the first day is logged. It replaces a
 * setup checklist that read as three equally urgent chores: the daily loop
 * is the thing, and setup that sharpens it is offered underneath, once.
 */
export function FirstDay({
  needsAssessment,
  needsGoal,
  onDismiss,
}: {
  needsAssessment: boolean;
  needsGoal: boolean;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-primary">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">How Today works</h2>
        <button type="button" onClick={onDismiss} className="text-sm text-muted active:opacity-70">
          Got it
        </button>
      </div>
      <ol className="mt-2 flex flex-col gap-1.5 text-sm leading-5">
        <li>
          <span className="font-bold text-primary">1.</span> Confirm how today looks, just below.
          Ten seconds.
        </li>
        <li>
          <span className="font-bold text-primary">2.</span> Do the plan top to bottom. ▶ Start
          opens the timer and logs your sets.
        </li>
        <li>
          <span className="font-bold text-primary">3.</span> Tap &ldquo;I did this&rdquo; and add a
          sentence on how it went. Tomorrow&apos;s plan reads it.
        </li>
      </ol>
      {(needsAssessment || needsGoal) && (
        <div className="mt-3 border-t border-border pt-2.5 text-sm leading-5">
          <p className="text-muted">Sharpen it when you have five minutes:</p>
          {needsGoal && (
            <Link href="/plan/goals/new" className="mt-1 block font-semibold text-primary">
              Add a goal → the coach plans toward it
            </Link>
          )}
          {needsAssessment && (
            <Link href="/assess/new" className="mt-1 block font-semibold text-primary">
              Take the self-assessment → the plan leans into your weakest area
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
