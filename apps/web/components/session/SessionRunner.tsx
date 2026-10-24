'use client';

/**
 * Run one workout: set today's numbers, follow the timer, log each set as it
 * finishes, save. The target comes from the training notebook (what you did
 * last time and how it went) and so does tomorrow's — the summary says what
 * the next session will ask for before you've left the board.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GRIP_LABELS,
  adjustAfterFirstSet,
  buildPhases,
  dayStartMs,
  formatLoad,
  gripForSet,
  log,
  now,
  progressWorkout,
  sessionSpec,
  shouldBeep,
  skipTarget,
  totalMs,
  trackEvent,
  trackableValue,
  workoutById,
  type BenchmarkRecord,
  type ExerciseLogRecord,
  type GripId,
  type Phase,
  type SetLog,
  type Workout,
  type WorkoutTarget,
} from '@tfc/core';
import { Button } from '../Button';
import { Card } from '../Card';
import { useRepository } from '../../lib/db/RepositoryProvider';
import { holdWakeLock, playCue, unlockAudio } from '../../lib/session/cues';
import { useIntervalTimer } from '../../lib/session/useIntervalTimer';
import { SetEditor, countsByEffort } from './SetEditor';
import { Stepper } from './Stepper';
import { TimerRing } from './TimerRing';

const DAY_MS = 24 * 60 * 60 * 1000;
const HANG_GRIPS: GripId[] = ['half-crimp', 'open-hand', 'open-crimp', 'pinch'];

type Stage = 'setup' | 'timer' | 'log' | 'saved';

interface Setup {
  loadLb: number;
  edgeMm?: number;
  grip?: GripId;
  level?: number;
  reps?: number;
  sets: number;
  grade?: string;
}

interface Loaded {
  workout: Workout;
  target: WorkoutTarget;
  prior: ExerciseLogRecord[];
  benchmarks: BenchmarkRecord[];
  bodyWeightLb?: number;
}

function workLabel(workout: Workout): string {
  if (workout.equipment.includes('hangboard') && workout.focus !== 'enduranceAerobic')
    return 'Hang';
  if (workout.equipment.includes('pull-up-bar')) return 'Pull';
  if (workout.equipment.includes('campus-board')) return 'Campus';
  return 'Climb';
}

function effortNoun(workout: Workout): string {
  const w = workLabel(workout);
  return w === 'Hang' ? 'hang' : w === 'Climb' ? 'lap' : 'rep';
}

function minutes(ms: number): string {
  const m = Math.round(ms / 60000);
  return m < 1 ? 'under a minute' : `about ${m} min`;
}

function phaseName(p: Phase, workout: Workout): string {
  if (p.kind === 'work') return `${workLabel(workout)} ${p.durationMs / 1000} s`;
  if (p.kind === 'rest') return `Rest ${p.durationMs / 1000} s`;
  if (p.kind === 'setRest') return `Set rest ${Math.round(p.durationMs / 1000)} s`;
  return 'Get ready';
}

function setupFrom(workout: Workout, t: WorkoutTarget): Setup {
  return {
    loadLb: t.loadLb ?? workout.defaults?.loadLb ?? 0,
    edgeMm: t.edgeMm ?? workout.defaults?.edgeMm,
    grip: t.grip ?? workout.defaults?.grip,
    level: t.level ?? workout.defaults?.level,
    reps: t.reps ?? (workout.metric === 'reps' ? workout.reps : undefined),
    sets: t.sets,
    grade: t.grade,
  };
}

export function SessionRunner({ workoutId }: { workoutId: string }) {
  const repo = useRepository();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [stage, setStage] = useState<Stage>('setup');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [adjustment, setAdjustment] = useState<'open' | 'done'>('open');
  const [pain, setPain] = useState(false);
  const [notes, setNotes] = useState('');
  const [sound, setSound] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ next: WorkoutTarget } | null>(null);

  useEffect(() => {
    const workout = workoutById(workoutId);
    if (!workout) {
      setMissing(true);
      return;
    }
    let on = true;
    Promise.all([repo.listExerciseLogs(), repo.listBenchmarks(), repo.listBodyWeights()]).then(
      ([logs, benchmarks, weights]) => {
        if (!on) return;
        // Same rule as the daily plan: today's sets don't move today's target.
        const prior = logs.filter((l) => l.date < dayStartMs(now()));
        const target = progressWorkout(workout, { logs: prior, benchmarks, nowMs: now() });
        setLoaded({
          workout,
          target,
          prior: logs,
          benchmarks,
          bodyWeightLb: [...weights].sort((a, b) => b.date - a.date)[0]?.lb,
        });
        setSetup(setupFrom(workout, target));
      },
    );
    return () => {
      on = false;
    };
  }, [repo, workoutId]);

  const workout = loaded?.workout ?? null;
  const spec = useMemo(
    () => (workout && setup ? sessionSpec(workout, setup) : null),
    [workout, setup],
  );
  const phases = useMemo(() => (spec ? buildPhases(spec) : []), [spec]);
  const timer = useIntervalTimer(phases);
  const rows = spec?.sets ?? setup?.sets ?? 0;

  // ── Cues: a tick on the last three seconds of rest, a tone at each change.
  const prev = useRef({ index: 0, remaining: 0 });
  const { index, remainingMs, phase, done } = timer.position;
  useEffect(() => {
    if (stage !== 'timer') return;
    const p = prev.current;
    if (done) {
      if (p.index !== -1) playCue('done', sound);
    } else if (phase && index !== p.index) {
      if (timer.started) playCue(phase.kind === 'work' ? 'go' : 'stop', sound);
    } else if (phase && timer.running && shouldBeep(p.remaining, remainingMs, phase.kind)) {
      playCue('tick', sound);
    }
    prev.current = { index, remaining: remainingMs };
  }, [stage, index, remainingMs, phase, done, sound, timer.started, timer.running]);

  // ── Keep the screen on while the clock runs.
  useEffect(() => {
    if (!timer.running) return;
    let release: (() => void) | null = null;
    let live = true;
    void holdWakeLock().then((r) => {
      if (live) release = r;
      else r();
    });
    return () => {
      live = false;
      release?.();
    };
  }, [timer.running]);

  if (missing) {
    return <p className="px-4 pt-6 text-muted">That workout isn’t in the catalog.</p>;
  }
  if (!loaded || !workout || !setup) return null;
  const { target } = loaded;
  const byEffort = countsByEffort(workout);
  const efforts = spec?.repsPerSet ?? workout.reps;

  const blankSet = (i: number, s: Setup): SetLog => ({
    completed: true,
    reps: byEffort
      ? efforts
      : workout.metric === 'reps' && workout.logs.includes('reps')
        ? s.reps
        : workout.logs.includes('reps')
          ? efforts
          : undefined,
    loadLb: workout.logs.includes('load') ? s.loadLb : undefined,
    grip: gripForSet(workout, i, s.grip),
    side: workout.logs.includes('side') ? (i % 2 === 0 ? 'left' : 'right') : undefined,
    seconds: workout.logs.includes('seconds') ? spec?.workSec : undefined,
    grade: workout.logs.includes('grade') ? s.grade : undefined,
  });

  const begin = (mode: 'timer' | 'log') => {
    unlockAudio();
    setSets(Array.from({ length: rows }, (_, i) => blankSet(i, setup)));
    setConfirmed(new Set());
    setStage(mode);
    trackEvent('workout_started', { workout: workout.id, mode });
    if (mode === 'timer') timer.start();
  };

  const updateSet = (i: number, next: SetLog) => {
    setSets((all) => all.map((s, j) => (j === i ? next : s)));
  };
  const confirmSet = (i: number, next: SetLog) => {
    updateSet(i, next);
    setConfirmed((c) => new Set(c).add(i));
    setEditing(null);
  };

  // Sets whose efforts are all behind the clock.
  const finishedSets = done
    ? rows
    : phase
      ? phase.kind === 'setRest'
        ? phase.set + 1
        : phase.set
      : 0;
  const pendingIndex =
    stage === 'timer'
      ? Array.from({ length: finishedSets }, (_, i) => i).find((i) => !confirmed.has(i))
      : undefined;

  /** Failed mid-set: record how many efforts went, jump to the rest. */
  const failNow = () => {
    if (!phase) return;
    const i = phase.set;
    updateSet(i, { ...sets[i], completed: false, reps: byEffort ? phase.rep : sets[i].reps });
    const rest = phases.find((p) => p.set === i && p.kind === 'setRest');
    timer.seek(rest ? rest.startMs : totalMs(phases));
  };

  const adj =
    adjustment === 'open' && confirmed.has(0) && sets[0]
      ? adjustAfterFirstSet(workout, { loadLb: setup.loadLb, edgeMm: setup.edgeMm }, sets[0])
      : null;
  const applyAdjustment = () => {
    if (!adj) return;
    if (adj.loadLb !== undefined) {
      const loadLb = adj.loadLb;
      setSetup((s) => (s ? { ...s, loadLb } : s));
      setSets((all) => all.map((s, i) => (confirmed.has(i) ? s : { ...s, loadLb })));
    }
    if (adj.edgeMm !== undefined) {
      const edgeMm = adj.edgeMm;
      setSetup((s) => (s ? { ...s, edgeMm } : s));
    }
    setAdjustment('done');
  };

  const included =
    stage === 'log' ? sets : sets.filter((_, i) => confirmed.has(i) || i < finishedSets);

  const save = async () => {
    if (saving || included.length === 0) return;
    setSaving(true);
    timer.pause();
    try {
      const grades = [...new Set(included.map((s) => s.grade).filter(Boolean))] as string[];
      const record = await repo.saveExerciseLog({
        date: now(),
        workoutId: workout.id,
        edgeMm: workout.equipment.includes('hangboard') ? setup.edgeMm : undefined,
        grip: workout.gripPlan ? undefined : setup.grip,
        level: workout.metric === 'level' ? setup.level : undefined,
        grade: grades.length > 0 ? grades.join(' / ') : setup.grade,
        bodyWeightLb: loaded.bodyWeightLb,
        sets: included,
        prescribedLabel: target.label,
        pain: pain || undefined,
        notes: notes.trim() || undefined,
      });
      const value = trackableValue(workout, record);
      if (value !== null && workout.trackableId) {
        await repo.saveBenchmark({ testId: workout.trackableId, value, date: record.date });
      }
      const next = progressWorkout(workout, {
        logs: [record, ...loaded.prior],
        benchmarks: loaded.benchmarks,
        nowMs: now() + DAY_MS,
      });
      log.info('session: saved', { workout: workout.id, sets: included.length, next: next.label });
      trackEvent('workout_logged', {
        workout: workout.id,
        sets: included.length,
        clean: included.filter((s) => s.completed).length,
      });
      setSaved({ next });
      setStage('saved');
    } finally {
      setSaving(false);
    }
  };

  // ── Saved ───────────────────────────────────────────────────────────────
  if (stage === 'saved' && saved) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <Card className="border-success">
          <p className="text-sm font-bold uppercase tracking-wide text-success">Logged</p>
          <h2 className="mt-1 text-lg font-bold">{workout.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {included.filter((s) => s.completed).length} of {included.length} sets clean
            {pain ? ' · pain noted' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Next time</p>
          <p className="mt-1 text-xl font-extrabold">{saved.next.label}</p>
          <p className="mt-1 text-sm leading-5 text-muted">{saved.next.because}</p>
          {saved.next.advice ? (
            <p className="mt-2 text-sm leading-5 text-warning">{saved.next.advice}</p>
          ) : null}
        </Card>
        <Button onClick={() => router.push('/train')}>Back to today</Button>
        <Button variant="secondary" onClick={() => router.push('/train/session')}>
          Another workout
        </Button>
      </div>
    );
  }

  const patchSetup = (p: Partial<Setup>) => setSetup({ ...setup, ...p });
  const bw = loaded.bodyWeightLb;
  const bwHint =
    bw && workout.logs.includes('load')
      ? `${Math.round(((bw + setup.loadLb) / bw) * 100)}% of body weight`
      : '− for assisted';

  // ── Setup ───────────────────────────────────────────────────────────────
  if (stage === 'setup') {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <Card
          className={
            target.kind === 'progress'
              ? 'border-success'
              : target.kind === 'backoff'
                ? 'border-warning'
                : 'border-primary'
          }
        >
          <p className="text-sm font-bold uppercase tracking-wide text-muted">
            {target.kind === 'progress'
              ? 'Today — up a step'
              : target.kind === 'backoff'
                ? 'Today — a step back'
                : target.kind === 'test'
                  ? 'Today — find your number'
                  : 'Today'}
          </p>
          <p className="mt-1 text-xl font-extrabold leading-7">{target.label}</p>
          <p className="mt-2 text-sm leading-5 text-muted">{target.because}</p>
          {target.advice ? (
            <p className="mt-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-sm leading-5 text-warning">
              {target.advice}
            </p>
          ) : null}
        </Card>

        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Set up</p>
          <div className="mt-1 divide-y divide-border/60">
            {workout.logs.includes('load') && (
              <Stepper
                label="Added weight"
                value={setup.loadLb}
                step={workout.metric === 'load' ? workout.step : 5}
                format={formatLoad}
                hint={bwHint}
                onChange={(loadLb) => patchSetup({ loadLb })}
              />
            )}
            {workout.equipment.includes('hangboard') && setup.edgeMm !== undefined && (
              <Stepper
                label="Edge"
                value={setup.edgeMm}
                step={workout.metric === 'edge' ? workout.step : 1}
                min={4}
                max={45}
                format={(n) => `${n} mm`}
                onChange={(edgeMm) => patchSetup({ edgeMm })}
              />
            )}
            {workout.metric === 'level' && (
              <Stepper
                label="Level"
                value={setup.level ?? 1}
                step={1}
                min={workout.min ?? 1}
                max={workout.max ?? 4}
                format={(n) => `L${n}`}
                onChange={(level) => patchSetup({ level })}
              />
            )}
            {workout.metric === 'reps' && (
              <Stepper
                label={
                  workout.id === 'pullup-intervals'
                    ? 'Pull-ups per minute'
                    : workout.id === 'frenchies'
                      ? 'Cycles per set'
                      : 'Intervals'
                }
                value={setup.reps ?? workout.reps}
                step={1}
                min={workout.min ?? 1}
                max={workout.max}
                onChange={(reps) => patchSetup({ reps })}
              />
            )}
            {workout.sets[0] !== workout.sets[1] && (
              <Stepper
                label="Sets"
                value={setup.sets}
                step={1}
                min={1}
                max={workout.sets[1]}
                hint={`Book range ${workout.sets[0]}–${workout.sets[1]}`}
                onChange={(n) => patchSetup({ sets: n })}
              />
            )}
            {workout.logs.includes('grade') && (
              <label className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-semibold">Grade</span>
                <input
                  value={setup.grade ?? ''}
                  onChange={(e) => patchSetup({ grade: e.target.value || undefined })}
                  placeholder="V5"
                  className="w-28 rounded-lg border border-border bg-surface-alt/50 px-2 py-2 text-right text-base font-bold"
                />
              </label>
            )}
          </div>
          {workout.equipment.includes('hangboard') && !workout.gripPlan && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HANG_GRIPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => patchSetup({ grip: g })}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
                    setup.grip === g
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted'
                  }`}
                >
                  {GRIP_LABELS[g]}
                </button>
              ))}
            </div>
          )}
          {spec && (
            <p className="mt-3 text-sm leading-5 text-muted">
              {spec.sets} {spec.sets === 1 ? 'set' : 'sets'}
              {spec.repsPerSet > 1
                ? ` × ${spec.repsPerSet} × ${spec.workSec} s on / ${spec.restSec} s off`
                : ''}
              {spec.sets > 1 ? ` · ${Math.round(spec.setRestSec / 60)} min between sets` : ''} ·{' '}
              {minutes(totalMs(phases))}
            </p>
          )}
        </Card>

        <details className="rounded-xl border border-border/80 bg-surface/70 p-4">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-muted">
            How — from the book
          </summary>
          <p className="mt-2 text-sm leading-5">{workout.how}</p>
          {workout.cues.map((c) => (
            <p key={c} className="mt-1 text-sm leading-5 text-muted">
              • {c}
            </p>
          ))}
        </details>

        <label className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted">Beeps</span>
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
        </label>

        {spec && <Button onClick={() => begin('timer')}>Start with timer</Button>}
        <Button variant="secondary" onClick={() => begin('log')}>
          Log without the timer
        </Button>
      </div>
    );
  }

  // ── Timer / log ─────────────────────────────────────────────────────────
  const nextPhase = !done && index >= 0 ? phases[index + 1] : undefined;
  const sub =
    phase?.kind === 'setRest'
      ? `Set ${phase.set + 1} done · set ${phase.set + 2} next`
      : phase && phase.kind !== 'prep'
        ? `Set ${phase.set + 1}/${rows}${efforts > 1 ? ` · ${effortNoun(workout)} ${phase.rep + 1}/${efforts}` : ''}`
        : undefined;
  const currentGrip = phase ? sets[phase.set]?.grip : undefined;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      {stage === 'timer' && (
        <Card>
          <TimerRing
            kind={done ? null : (phase?.kind ?? null)}
            remainingMs={remainingMs}
            durationMs={phase?.durationMs ?? 1}
            workLabel={workLabel(workout)}
            sub={sub}
          />
          <div className="mt-2 text-center">
            {currentGrip && !done ? (
              <p className="text-base font-bold">{GRIP_LABELS[currentGrip]}</p>
            ) : null}
            <p className="text-sm text-muted">
              {workout.logs.includes('load') ? `${formatLoad(setup.loadLb)}` : ''}
              {setup.edgeMm && workout.equipment.includes('hangboard')
                ? ` · ${setup.edgeMm} mm`
                : ''}
              {nextPhase ? ` · next: ${phaseName(nextPhase, workout)}` : ''}
            </p>
          </div>
          {!done && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => timer.seek(skipTarget(phases, timer.elapsedMs))}
                className="h-12 rounded-xl border border-border px-4 text-sm font-semibold text-muted active:scale-95"
              >
                Skip ⏭
              </button>
              <button
                type="button"
                onClick={timer.running ? timer.pause : timer.start}
                className="h-16 w-16 rounded-full bg-brand text-2xl font-bold text-primary-text shadow-lg shadow-primary/25 active:scale-95"
                aria-label={timer.running ? 'Pause' : 'Resume'}
              >
                {timer.running ? '❚❚' : '▶'}
              </button>
              {phase?.kind === 'work' ? (
                <button
                  type="button"
                  onClick={failNow}
                  className="h-12 rounded-xl border border-danger/60 px-4 text-sm font-semibold text-danger active:scale-95"
                >
                  Failed ✕
                </button>
              ) : (
                <span className="w-[5.5rem]" />
              )}
            </div>
          )}
        </Card>
      )}

      {adj && (
        <Card className="border-warning">
          <p className="text-sm leading-5">{adj.message}</p>
          <div className="mt-2 flex gap-2">
            {adj.loadLb !== undefined || adj.edgeMm !== undefined ? (
              <button
                type="button"
                onClick={applyAdjustment}
                className="rounded-lg bg-warning/20 px-3 py-1.5 text-sm font-bold text-warning"
              >
                Apply
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAdjustment('done')}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted"
            >
              Keep the plan
            </button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {sets.map((s, i) => {
          const isPending = i === pendingIndex;
          const show =
            stage === 'log' || isPending || editing === i || confirmed.has(i) || i < finishedSets;
          if (!show) return null;
          if (confirmed.has(i) && editing !== i && stage === 'timer') {
            return (
              <button
                key={i}
                type="button"
                onClick={() => setEditing(i)}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-alt/30 px-3 py-2 text-left text-sm"
              >
                <span className="font-semibold">
                  <span className={s.completed ? 'text-success' : 'text-danger'}>
                    {s.completed ? '✓' : '✕'}
                  </span>{' '}
                  Set {i + 1}
                  {s.grip ? <span className="text-muted"> · {GRIP_LABELS[s.grip]}</span> : null}
                  {s.loadLb !== undefined && workout.logs.includes('load') ? (
                    <span className="text-muted"> · {formatLoad(s.loadLb)}</span>
                  ) : null}
                  {!s.completed && byEffort ? (
                    <span className="text-muted">
                      {' '}
                      · {s.reps ?? 0}/{efforts}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted">{s.rpe !== undefined ? `RPE ${s.rpe}` : 'edit'}</span>
              </button>
            );
          }
          return (
            <div key={i}>
              <SetEditor
                index={i}
                workout={workout}
                effortsPerSet={efforts}
                set={s}
                pending={isPending}
                onChange={(next) =>
                  stage === 'timer' && next.rpe !== undefined && next.rpe !== s.rpe
                    ? confirmSet(i, next)
                    : updateSet(i, next)
                }
                onRemove={
                  stage === 'log' && sets.length > 1
                    ? () => setSets((all) => all.filter((_, j) => j !== i))
                    : undefined
                }
              />
              {stage === 'timer' && (isPending || editing === i) ? (
                <button
                  type="button"
                  onClick={() => confirmSet(i, s)}
                  className="mt-1 w-full rounded-lg py-1.5 text-sm font-semibold text-primary"
                >
                  Save set {i + 1}
                </button>
              ) : null}
            </div>
          );
        })}
        {stage === 'log' && (
          <button
            type="button"
            onClick={() => setSets((all) => [...all, blankSet(all.length, setup)])}
            className="rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-muted"
          >
            + Add set
          </button>
        )}
      </div>

      {(stage === 'log' || included.length > 0) && (
        <Card>
          <button
            type="button"
            onClick={() => setPain(!pain)}
            aria-pressed={pain}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
              pain ? 'border-danger bg-danger/10 text-danger' : 'border-border text-muted'
            }`}
          >
            {pain ? '⚠ Felt tendon or joint pain' : 'Any tendon or joint pain? Tap if so'}
          </button>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes — how it felt, what went"
            rows={2}
            className="mt-2 w-full rounded-lg border border-border bg-surface-alt/40 px-3 py-2 text-sm"
          />
        </Card>
      )}

      <Button onClick={save} disabled={saving || included.length === 0}>
        {saving
          ? 'Saving…'
          : included.length === 0
            ? 'Log a set to save'
            : `Save ${included.length} ${included.length === 1 ? 'set' : 'sets'}`}
      </Button>
      {stage === 'timer' && !done && (
        <Button
          variant="secondary"
          onClick={() => {
            timer.pause();
            setStage('log');
          }}
        >
          Stop the timer, just log
        </Button>
      )}
    </div>
  );
}
