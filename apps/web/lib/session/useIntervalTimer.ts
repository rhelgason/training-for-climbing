'use client';

/**
 * A pausable clock over a list of timer phases. Elapsed time is computed from
 * timestamps rather than counted ticks, so a backgrounded tab that throttles
 * the interval still lands on the right second when it comes back.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { phaseAt, totalMs, type Phase, type PhasePosition } from '@tfc/core';

const TICK_MS = 100;

export interface IntervalTimer {
  elapsedMs: number;
  running: boolean;
  started: boolean;
  position: PhasePosition;
  start: () => void;
  pause: () => void;
  /** Jump to an elapsed time (skip, next set). */
  seek: (ms: number) => void;
  reset: () => void;
}

export function useIntervalTimer(phases: Phase[]): IntervalTimer {
  const [elapsedMs, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  // Elapsed at the last start/seek, and the clock time it happened.
  const base = useRef({ elapsed: 0, at: 0 });
  // Latest elapsed, so start() right after reset() or seek() resumes from it.
  const latest = useRef(0);
  const end = totalMs(phases);

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const next = base.current.elapsed + (now() - base.current.at);
      if (next >= end) {
        latest.current = end;
        setElapsed(end);
        setRunning(false);
      } else {
        latest.current = next;
        setElapsed(next);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, end]);

  const start = useCallback(() => {
    base.current = { elapsed: latest.current, at: now() };
    setStarted(true);
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (!running) return;
    const at = base.current.elapsed + (now() - base.current.at);
    base.current = { elapsed: at, at: now() };
    latest.current = at;
    setElapsed(at);
    setRunning(false);
  }, [running]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(end, ms));
      base.current = { elapsed: clamped, at: now() };
      latest.current = clamped;
      setElapsed(clamped);
      if (clamped >= end) setRunning(false);
    },
    [end],
  );

  const reset = useCallback(() => {
    base.current = { elapsed: 0, at: now() };
    latest.current = 0;
    setElapsed(0);
    setRunning(false);
    setStarted(false);
  }, []);

  return {
    elapsedMs,
    running,
    started,
    position: phaseAt(phases, elapsedMs),
    start,
    pause,
    seek,
    reset,
  };
}
