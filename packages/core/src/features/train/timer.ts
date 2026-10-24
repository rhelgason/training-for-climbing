/**
 * Interval timer — turns a workout's interval shape into a flat list of phases
 * a clock can walk through: get ready, hang 7 s, rest 53 s, hang, …, rest
 * between sets, and so on.
 *
 * Pure and clock-free: the UI keeps the elapsed time (and pauses it) and asks
 * `phaseAt` where that lands. Keeping it here means the numbers the timer runs
 * are the same ones the plan prescribed and the logger records.
 */
import type { IntervalSpec } from '../../content/workouts';

export type PhaseKind = 'prep' | 'work' | 'rest' | 'setRest';

export interface Phase {
  kind: PhaseKind;
  /** 0-based set this phase belongs to. */
  set: number;
  /** 0-based effort within the set (work and the rest after it). */
  rep: number;
  durationMs: number;
  /** Elapsed time at which the phase begins. */
  startMs: number;
}

export interface PhasePosition {
  /** Index into the phase list, or -1 once the whole session is done. */
  index: number;
  phase: Phase | null;
  /** Time left in the current phase. */
  remainingMs: number;
  done: boolean;
}

/** Default lead-in before the first effort. */
export const PREP_SEC = 10;

/**
 * Every phase in order. Rest after the last effort of a set is replaced by
 * the between-set rest; nothing follows the very last effort.
 */
export function buildPhases(spec: IntervalSpec, prepSec = PREP_SEC): Phase[] {
  const phases: Phase[] = [];
  let at = 0;
  const push = (kind: PhaseKind, set: number, rep: number, sec: number) => {
    if (sec <= 0) return;
    phases.push({ kind, set, rep, durationMs: sec * 1000, startMs: at });
    at += sec * 1000;
  };

  push('prep', 0, 0, prepSec);
  for (let set = 0; set < spec.sets; set++) {
    for (let rep = 0; rep < spec.repsPerSet; rep++) {
      push('work', set, rep, spec.workSec);
      const lastRep = rep === spec.repsPerSet - 1;
      const lastSet = set === spec.sets - 1;
      if (!lastRep) push('rest', set, rep, spec.restSec);
      else if (!lastSet) push('setRest', set, rep, spec.setRestSec);
    }
  }
  return phases;
}

export function totalMs(phases: Phase[]): number {
  const last = phases[phases.length - 1];
  return last ? last.startMs + last.durationMs : 0;
}

/** Where `elapsedMs` lands in the session. */
export function phaseAt(phases: Phase[], elapsedMs: number): PhasePosition {
  if (phases.length === 0 || elapsedMs >= totalMs(phases)) {
    return { index: -1, phase: null, remainingMs: 0, done: true };
  }
  const t = Math.max(0, elapsedMs);
  // Binary search: the last phase starting at or before t.
  let lo = 0;
  let hi = phases.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (phases[mid].startMs <= t) lo = mid;
    else hi = mid - 1;
  }
  const phase = phases[lo];
  return { index: lo, phase, remainingMs: phase.startMs + phase.durationMs - t, done: false };
}

/** Elapsed time at the start of the next phase — what "skip" jumps to. */
export function skipTarget(phases: Phase[], elapsedMs: number): number {
  const pos = phaseAt(phases, elapsedMs);
  if (pos.done || !pos.phase) return totalMs(phases);
  return pos.phase.startMs + pos.phase.durationMs;
}

/** Elapsed time at the start of the first phase of `set` — for "skip to next set". */
export function setStartMs(phases: Phase[], set: number): number {
  const first = phases.find((p) => p.set === set && p.kind === 'work');
  return first ? first.startMs : totalMs(phases);
}

/** Whole seconds to show on the clock, rounding up so "1" shows until zero. */
export function displaySeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/** Countdown beeps: the last three seconds of rest or prep, and the start of each phase. */
export function shouldBeep(
  prevRemainingMs: number,
  remainingMs: number,
  kind: PhaseKind,
): 'tick' | null {
  if (kind === 'work') return null;
  const prev = displaySeconds(prevRemainingMs);
  const now = displaySeconds(remainingMs);
  return now !== prev && now >= 1 && now <= 3 ? 'tick' : null;
}
