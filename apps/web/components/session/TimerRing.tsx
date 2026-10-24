'use client';

import { displaySeconds, type PhaseKind } from '@tfc/core';

const PHASE_STYLE: Record<PhaseKind, { label: string; color: string }> = {
  prep: { label: 'Get ready', color: 'var(--color-warning)' },
  work: { label: 'Go', color: 'var(--color-success)' },
  rest: { label: 'Rest', color: 'var(--color-primary)' },
  setRest: { label: 'Set rest', color: 'var(--color-mental)' },
};

interface Props {
  kind: PhaseKind | null;
  remainingMs: number;
  durationMs: number;
  /** Replaces "Go" during work, e.g. "Hang". */
  workLabel?: string;
  sub?: string;
}

const R = 108;
const C = 2 * Math.PI * R;

function clock(sec: number): string {
  if (sec < 60) return String(sec);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** The countdown: a ring that drains with the phase, the seconds huge in the middle. */
export function TimerRing({ kind, remainingMs, durationMs, workLabel, sub }: Props) {
  const style = kind ? PHASE_STYLE[kind] : { label: 'Done', color: 'var(--color-success)' };
  const fraction = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const label = kind === 'work' && workLabel ? workLabel : style.label;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[18rem]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="120"
          cy="120"
          r={R}
          fill="none"
          stroke="var(--color-surface-alt)"
          strokeWidth="12"
        />
        <circle
          cx="120"
          cy="120"
          r={R}
          fill="none"
          stroke={style.color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 200ms' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        role="timer"
        aria-live="off"
      >
        <span
          className="text-sm font-bold uppercase tracking-[0.2em]"
          style={{ color: style.color }}
        >
          {label}
        </span>
        <span className="display text-7xl font-extrabold tabular-nums leading-none">
          {kind ? clock(displaySeconds(remainingMs)) : '✓'}
        </span>
        {sub ? <span className="mt-2 text-sm font-semibold text-muted">{sub}</span> : null}
      </div>
    </div>
  );
}
