'use client';

/**
 * One set, logged in two or three taps: clean or failed, how hard, and — only
 * when the workout records it — load, count, time, or grade. Defaults come
 * from the session setup so a normal set is "Clean → 8.5".
 */
import { GRIP_LABELS, formatLoad, type SetLog, type Workout } from '@tfc/core';
import { Stepper } from './Stepper';

export const RPE_CHIPS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

interface Props {
  index: number;
  workout: Workout;
  /** Efforts per set (hangs, laps). Failing records how many were done. */
  effortsPerSet: number;
  set: SetLog;
  onChange: (set: SetLog) => void;
  onRemove?: () => void;
  /** Highlighted while it's waiting to be filled in. */
  pending?: boolean;
}

function chip(active: boolean, tone: 'primary' | 'success' | 'danger' = 'primary') {
  const on =
    tone === 'success'
      ? 'border-success bg-success/15 text-success'
      : tone === 'danger'
        ? 'border-danger bg-danger/15 text-danger'
        : 'border-primary bg-primary/15 text-primary';
  return `rounded-lg border px-2.5 py-1.5 text-sm font-bold tabular-nums transition active:scale-95 ${
    active ? on : 'border-border text-muted'
  }`;
}

/** Hang-type workouts count efforts by clean/failed; the rest count reps directly. */
export function countsByEffort(workout: Workout): boolean {
  return workout.equipment.includes('hangboard') && workout.metric !== 'reps';
}

export function SetEditor({
  index,
  workout,
  effortsPerSet,
  set,
  onChange,
  onRemove,
  pending,
}: Props) {
  const patch = (p: Partial<SetLog>) => onChange({ ...set, ...p });
  const byEffort = countsByEffort(workout);
  const unit = workout.focus === 'powerEndurance' && !byEffort ? 'laps' : 'hangs';

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        pending ? 'border-primary/60 bg-primary/5' : 'border-border/70 bg-surface-alt/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          Set {index + 1}
          {set.grip ? (
            <span className="ml-2 font-semibold text-muted">{GRIP_LABELS[set.grip]}</span>
          ) : null}
          {set.side ? (
            <span className="ml-2 font-semibold text-muted">
              {set.side === 'left' ? 'Left' : 'Right'}
            </span>
          ) : null}
          {set.loadLb !== undefined && workout.logs.includes('load') ? (
            <span className="ml-2 font-semibold text-muted">{formatLoad(set.loadLb)}</span>
          ) : null}
        </p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove set ${index + 1}`}
            className="text-sm text-muted"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className={`flex-1 ${chip(set.completed, 'success')}`}
          onClick={() => patch({ completed: true, reps: byEffort ? effortsPerSet : set.reps })}
        >
          ✓ Clean
        </button>
        <button
          type="button"
          className={`flex-1 ${chip(!set.completed, 'danger')}`}
          onClick={() =>
            patch({
              completed: false,
              reps: byEffort
                ? Math.max(0, Math.min(set.reps ?? effortsPerSet, effortsPerSet) - 1)
                : set.reps,
            })
          }
        >
          ✕ Failed
        </button>
      </div>

      {!set.completed && byEffort && effortsPerSet > 1 ? (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted">Clean {unit} before it went</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Array.from({ length: effortsPerSet }, (_, n) => (
              <button
                key={n}
                type="button"
                className={chip(set.reps === n)}
                onClick={() => patch({ reps: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2">
        <p className="text-xs font-semibold text-muted">RPE</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {RPE_CHIPS.map((r) => (
            <button
              key={r}
              type="button"
              className={chip(set.rpe === r)}
              onClick={() => patch({ rpe: set.rpe === r ? undefined : r })}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {workout.logs.includes('load') ? (
        <Stepper
          label="Load"
          value={set.loadLb ?? 0}
          step={workout.step && workout.metric === 'load' ? workout.step : 5}
          format={formatLoad}
          onChange={(loadLb) => patch({ loadLb })}
        />
      ) : null}
      {workout.logs.includes('reps') && !byEffort ? (
        <Stepper
          label={workout.id === 'pullup-intervals' ? 'Pull-ups per minute' : 'Count'}
          value={set.reps ?? 0}
          step={1}
          min={0}
          onChange={(reps) => patch({ reps })}
        />
      ) : null}
      {workout.logs.includes('seconds') ? (
        <Stepper
          label="Seconds"
          value={set.seconds ?? 0}
          step={workout.intervals && (workout.intervals({ sets: 1 }).workSec ?? 0) >= 60 ? 15 : 1}
          min={0}
          onChange={(seconds) => patch({ seconds })}
        />
      ) : null}
      {workout.logs.includes('grade') ? (
        <label className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Grade</span>
          <input
            value={set.grade ?? ''}
            onChange={(e) => patch({ grade: e.target.value.trim() ? e.target.value : undefined })}
            placeholder="V5"
            className="w-24 rounded-lg border border-border bg-surface-alt/50 px-2 py-1.5 text-right text-sm font-bold"
          />
        </label>
      ) : null}
    </div>
  );
}
