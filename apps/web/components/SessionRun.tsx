'use client';

/**
 * Today's plan, one step at a time.
 *
 * The list view asks the climber to hold the session in their head; this asks
 * one thing: do this, then tap Done. A step that runs a catalogued workout
 * carries its own timer and set logger; a lift asks for the number; warm-up
 * and cool-down are just a tick. The last Done logs the day and opens the
 * debrief.
 */
import {
  latestForTest,
  protocolById,
  workoutById,
  type BenchmarkRecord,
  type ExerciseLogRecord,
} from '@tfc/core';
import { Card } from './Card';
import { ProtocolMetric } from './ProtocolMetric';
import { SessionRunner } from './session/SessionRunner';
import type { RunState } from '../lib/session/runState';

interface Props {
  run: RunState;
  /** Workouts already logged today, so a finished one isn't run twice. */
  todayLogs: ExerciseLogRecord[];
  benchmarks: BenchmarkRecord[];
  metrics: Record<string, number>;
  onMetric: (protocolId: string, value: number) => void;
  onAdvance: (skipped: boolean) => void;
  onPause: () => void;
  finishing: boolean;
}

export function SessionRun({
  run,
  todayLogs,
  benchmarks,
  metrics,
  onMetric,
  onAdvance,
  onPause,
  finishing,
}: Props) {
  const step = run.steps[run.index];
  const total = run.steps.length;
  const last = run.index === total - 1;
  const workout = step.workoutId && step.target ? workoutById(step.workoutId) : null;
  const logged = workout ? todayLogs.some((l) => l.workoutId === workout.id) : false;
  const protocol = step.protocolId ? protocolById(step.protocolId) : null;

  return (
    <Card className="border-primary" data-nux="run">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">
          Step {run.index + 1} of {total}
        </p>
        <button type="button" onClick={onPause} className="text-sm font-semibold text-muted">
          ⏸ Pause
        </button>
      </div>
      <div className="mt-2 flex gap-1">
        {run.steps.map((s, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < run.index
                ? run.skipped.includes(s.text)
                  ? 'bg-border'
                  : 'bg-success'
                : i === run.index
                  ? 'bg-brand'
                  : 'bg-border/60'
            }`}
          />
        ))}
      </div>

      <p className="mt-4 text-base leading-6">{step.text}</p>

      {workout && !logged && (
        <div className="mt-4">
          <SessionRunner
            key={`${run.index}:${workout.id}`}
            workoutId={workout.id}
            onFinish={() => onAdvance(false)}
          />
        </div>
      )}
      {workout && logged && <p className="mt-3 text-sm font-semibold text-success">✓ Logged</p>}

      {protocol && (
        <ProtocolMetric
          protocol={protocol}
          value={metrics[protocol.id] ?? protocol.defaultValue}
          previous={latestForTest(benchmarks, protocol.id)?.value ?? null}
          onChange={(value) => onMetric(protocol.id, value)}
          disabled={finishing}
        />
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => onAdvance(true)}
          disabled={finishing}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => onAdvance(false)}
          disabled={finishing}
          className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-primary-text disabled:opacity-60"
        >
          {finishing ? 'Saving…' : last ? 'Done — finish session' : 'Done — next'}
        </button>
      </div>
    </Card>
  );
}
