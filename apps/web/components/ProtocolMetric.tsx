'use client';

/**
 * The inline number on a prescribed protocol step.
 *
 * The whole design constraint is that this must cost one tap on a normal day.
 * It shows what you did last time, pre-filled; you confirm by doing nothing and
 * logging the session, or nudge it with +/−. There is no separate screen, no
 * empty form, and nothing to fill in when the plan doesn't prescribe something
 * measurable — which is why it gets used where a "log your workout" feature
 * wouldn't.
 */
import { formatProtocolValue, type TrackableProtocol } from '@tfc/core';

interface Props {
  protocol: TrackableProtocol;
  value: number;
  /** The previous recorded value, if any — shown so progress is visible. */
  previous: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function ProtocolMetric({ protocol, value, previous, onChange, disabled }: Props) {
  const delta = previous === null ? null : value - previous;
  const improved =
    delta === null || delta === 0 ? null : protocol.lowerIsBetter ? delta < 0 : delta > 0;

  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-surface-alt/40 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{protocol.metricLabel}</p>
          {protocol.heldConstant ? (
            <p className="truncate text-xs text-muted">{protocol.heldConstant}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={`Decrease ${protocol.metricLabel}`}
            disabled={disabled}
            onClick={() => onChange(Math.max(0, value - protocol.step))}
            className="h-8 w-8 rounded-lg border border-border text-lg font-bold text-muted disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-20 text-center text-sm font-bold tabular-nums">
            {formatProtocolValue(protocol, value)}
          </span>
          <button
            type="button"
            aria-label={`Increase ${protocol.metricLabel}`}
            disabled={disabled}
            onClick={() => onChange(value + protocol.step)}
            className="h-8 w-8 rounded-lg border border-border text-lg font-bold text-muted disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        {previous === null ? (
          'First time — this becomes your baseline.'
        ) : delta === 0 ? (
          `Same as last time (${formatProtocolValue(protocol, previous)}).`
        ) : (
          <>
            Last time {formatProtocolValue(protocol, previous)}
            <span className={improved ? 'text-success' : 'text-warning'}>
              {' '}
              · {improved ? 'up' : 'down'} on last session
            </span>
          </>
        )}
      </p>
    </div>
  );
}
