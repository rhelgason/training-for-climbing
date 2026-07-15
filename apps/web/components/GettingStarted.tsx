'use client';

import { Card } from './Card';

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  onClick: () => void;
}

/**
 * First-run checklist that orients a new user through the core loop: assess →
 * set a goal → log a day. The host hides it once everything's done or dismissed.
 */
export function GettingStarted({
  steps,
  onDismiss,
}: {
  steps: OnboardingStep[];
  onDismiss: () => void;
}) {
  return (
    <Card className="border-primary">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Getting started</h2>
        <button type="button" onClick={onDismiss} className="text-sm text-muted active:opacity-70">
          Dismiss
        </button>
      </div>
      {steps.map((step) => (
        <button
          key={step.key}
          type="button"
          onClick={step.done ? undefined : step.onClick}
          className="flex w-full items-center gap-2 py-2 text-left"
        >
          <span className={`w-6 text-lg ${step.done ? 'text-success' : 'text-muted'}`}>
            {step.done ? '✓' : '○'}
          </span>
          <span className={`flex-1 ${step.done ? 'text-muted line-through' : ''}`}>
            {step.label}
          </span>
        </button>
      ))}
    </Card>
  );
}
