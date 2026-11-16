'use client';

/**
 * Timing for the fitness tests, so nobody needs a partner with a phone.
 *
 *  - `stopwatch`: start, stop, the seconds go in the field (max hang, rope
 *    climb, campus ladder).
 *  - `repeaters`: Hörst's 5-on / 5-off test on the big ring, called out by
 *    beeps. Tap "Let go" when a hang fails; the time from the first hang goes
 *    in the field.
 *  - `hang5`: the 5-second hang of the max-weight test, counted down.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPhases, shouldBeep } from '@tfc/core';
import { holdWakeLock, playCue, unlockAudio } from '../../lib/session/cues';
import { TimerRing } from './TimerRing';
import { useIntervalTimer } from '../../lib/session/useIntervalTimer';

const PREP_SEC = 5;
/** Far more hangs than anyone completes; the test ends on "Let go". */
const MAX_HANGS = 200;

function Stopwatch({ onResult }: { onResult: (seconds: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 50);
    return () => clearInterval(id);
  }, [startedAt]);

  const toggle = () => {
    unlockAudio();
    if (startedAt === null) {
      playCue('go', true);
      setElapsed(0);
      setStartedAt(performance.now());
    } else {
      const secs = (performance.now() - startedAt) / 1000;
      playCue('stop', true);
      setStartedAt(null);
      setElapsed(secs);
      onResult(Math.round(secs * 10) / 10);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        className={`h-11 rounded-xl px-4 text-sm font-bold active:scale-95 ${
          startedAt === null ? 'bg-brand text-primary-text' : 'bg-danger text-white'
        }`}
      >
        {startedAt === null ? '▶ Stopwatch' : '■ Stop'}
      </button>
      <span className="text-2xl font-extrabold tabular-nums">{elapsed.toFixed(1)} s</span>
    </div>
  );
}

/** Screen on while a test clock runs; the climber's hands are on the board. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
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
  }, [on]);
}

/** Beeps at each change and on the last three seconds of rest. */
function useCues(timer: ReturnType<typeof useIntervalTimer>) {
  const { phase, index, remainingMs } = timer.position;
  const prev = useRef({ index: 0, remaining: 0 });
  useEffect(() => {
    const p = prev.current;
    if (timer.running && phase) {
      if (index !== p.index) playCue(phase.kind === 'work' ? 'go' : 'stop', true);
      else if (shouldBeep(p.remaining, remainingMs, phase.kind)) playCue('tick', true);
    }
    prev.current = { index, remaining: remainingMs };
  }, [timer.running, phase, index, remainingMs]);
}

function Previous({ seconds, unit = 's' }: { seconds?: number; unit?: string }) {
  if (seconds === undefined) return null;
  return (
    <p className="mt-1 text-center text-sm text-muted">
      Last time:{' '}
      <span className="font-semibold text-text">
        {seconds} {unit}
      </span>
    </p>
  );
}

/**
 * Hörst's 5-on / 5-off test, on the same big ring as a workout. Hangs and
 * rests are called by beeps; "Let go" ends it and the time from the first
 * hang goes in the field.
 */
function Repeaters({
  onResult,
  previous,
}: {
  onResult: (seconds: number) => void;
  previous?: number;
}) {
  const phases = useMemo(
    () =>
      buildPhases(
        { sets: 1, repsPerSet: MAX_HANGS, workSec: 5, restSec: 5, setRestSec: 0 },
        PREP_SEC,
      ),
    [],
  );
  const timer = useIntervalTimer(phases);
  const { phase, remainingMs } = timer.position;
  const [result, setResult] = useState<number | null>(null);
  useCues(timer);
  useWakeLock(timer.running);

  const hanging = Math.max(0, timer.elapsedMs / 1000 - PREP_SEC);
  const letGo = () => {
    timer.pause();
    playCue('done', true);
    const total = Math.round(hanging);
    setResult(total);
    onResult(total);
  };

  if (!timer.started || result !== null) {
    return (
      <div className="mt-3 rounded-xl border border-border/70 bg-surface-alt/30 p-3">
        {result !== null && (
          <p className="text-center text-2xl font-extrabold tabular-nums">{result} s</p>
        )}
        <Previous seconds={previous} />
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            setResult(null);
            timer.reset();
            timer.start();
          }}
          className="mt-3 h-12 w-full rounded-xl bg-brand text-base font-bold text-primary-text active:scale-95"
        >
          {result === null ? '▶ Start 5 on / 5 off' : 'Test again'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-surface-alt/30 p-3">
      <TimerRing
        kind={phase?.kind ?? null}
        remainingMs={remainingMs}
        durationMs={phase?.durationMs ?? 1}
        workLabel="Hang"
        sub={
          phase && phase.kind !== 'prep'
            ? `Hang ${phase.rep + 1} · ${Math.floor(hanging)} s total`
            : 'Hands on the 10 mm edge'
        }
      />
      <Previous seconds={previous} />
      <button
        type="button"
        onClick={letGo}
        className="mt-3 h-14 w-full rounded-xl bg-danger text-lg font-bold text-white active:scale-95"
      >
        Let go — stop
      </button>
    </div>
  );
}

/**
 * The 5-second hang of the max-weight test, counted down so the climber
 * isn't guessing. Pass or fail is theirs to call: add weight and go again
 * after the rest, and enter the most that held.
 */
function FiveSecondHang() {
  const phases = useMemo(
    () => buildPhases({ sets: 1, repsPerSet: 1, workSec: 5, restSec: 0, setRestSec: 0 }, PREP_SEC),
    [],
  );
  const timer = useIntervalTimer(phases);
  const { phase, remainingMs, done } = timer.position;
  useCues(timer);
  useWakeLock(timer.running);
  useEffect(() => {
    if (timer.started && done) playCue('done', true);
  }, [timer.started, done]);

  if (!timer.started) {
    return (
      <button
        type="button"
        onClick={() => {
          unlockAudio();
          timer.reset();
          timer.start();
        }}
        className="mt-3 h-12 w-full rounded-xl bg-brand text-base font-bold text-primary-text active:scale-95"
      >
        ▶ 5 s hang
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-surface-alt/30 p-3">
      <TimerRing
        kind={done ? null : (phase?.kind ?? null)}
        remainingMs={remainingMs}
        durationMs={phase?.durationMs ?? 1}
        workLabel="Hang"
        sub={done ? 'Held it? Add weight, rest 3 min, go again.' : undefined}
      />
      {done && (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            timer.reset();
            timer.start();
          }}
          className="mt-3 h-12 w-full rounded-xl border border-border text-base font-bold active:scale-95"
        >
          Next attempt
        </button>
      )}
    </div>
  );
}

export function TestTimer({
  mode,
  onResult,
  previous,
}: {
  mode: 'stopwatch' | 'repeaters' | 'hang5';
  onResult: (seconds: number) => void;
  /** The last recorded result, to aim at. */
  previous?: number;
}) {
  if (mode === 'repeaters') return <Repeaters onResult={onResult} previous={previous} />;
  if (mode === 'hang5') return <FiveSecondHang />;
  return (
    <>
      <Stopwatch onResult={onResult} />
      <Previous seconds={previous} />
    </>
  );
}
