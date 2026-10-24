'use client';

interface Props {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  format?: (n: number) => string;
  onChange: (n: number) => void;
  /** Hint under the label, e.g. "last time +25 lb". */
  hint?: string;
}

/** Big-target − value + control, sized for chalky thumbs. */
export function Stepper({ label, value, step, min, max, format, onChange, hint }: Props) {
  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          disabled={min !== undefined && value <= min}
          className="h-10 w-10 rounded-xl border border-border bg-surface-alt/50 text-xl font-bold text-muted active:scale-95 disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-[5.5rem] text-center text-lg font-bold tabular-nums">
          {format ? format(value) : value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          disabled={max !== undefined && value >= max}
          className="h-10 w-10 rounded-xl border border-border bg-surface-alt/50 text-xl font-bold text-muted active:scale-95 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
