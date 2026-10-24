'use client';

/**
 * Timing for the fitness tests, so nobody needs a partner with a phone.
 *
 *  - `stopwatch`: start, stop, the seconds go in the field (max hang, rope
 *    climb, campus ladder).
 *  - `repeaters`: Hörst's 5-on / 5-off test, called out by beeps. Tap "Let go"
 *    when a hang fails; the total time from the first hang goes in the field.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPhases, shouldBeep } from '@tfc/core';
import { playCue, unlockAudio } from '../../lib/session/cues';
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

function Repeaters({ onResult }: { onResult: (seconds: number) => void }) {
  const phases = useMemo(
    () =>
      buildPhases(
        { sets: 1, repsPerSet: MAX_HANGS, workSec: 5, restSec: 5, setRestSec: 0 },
        PREP_SEC,
      ),
    [],
  );
  const timer = useIntervalTimer(phases);
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

  const letGo = () => {
    timer.pause();
    const total = Math.max(0, timer.elapsedMs / 1000 - PREP_SEC);
    playCue('done', true);
    onResult(Math.round(total));
  };

  const label = !timer.started
    ? ''
    : phase?.kind === 'work'
      ? `HANG · ${Math.ceil(remainingMs / 1000)}`
      : phase?.kind === 'rest'
        ? `rest · ${Math.ceil(remainingMs / 1000)}`
        : phase?.kind === 'prep'
          ? `ready · ${Math.ceil(remainingMs / 1000)}`
          : '';

  return (
    <div className="mt-2 flex items-center gap-3">
      {!timer.running ? (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            timer.reset();
            timer.start();
          }}
          className="h-11 rounded-xl bg-brand px-4 text-sm font-bold text-primary-text active:scale-95"
        >
          ▶ 5 on / 5 off
        </button>
      ) : (
        <button
          type="button"
          onClick={letGo}
          className="h-11 rounded-xl bg-danger px-4 text-sm font-bold text-white active:scale-95"
        >
          Let go
        </button>
      )}
      <span
        className={`text-xl font-extrabold tabular-nums ${
          phase?.kind === 'work' && timer.running ? 'text-success' : 'text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function TestTimer({
  mode,
  onResult,
}: {
  mode: 'stopwatch' | 'repeaters';
  onResult: (seconds: number) => void;
}) {
  return mode === 'repeaters' ? (
    <Repeaters onResult={onResult} />
  ) : (
    <Stopwatch onResult={onResult} />
  );
}
