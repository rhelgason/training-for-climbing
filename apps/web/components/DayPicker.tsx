'use client';

/**
 * Which day a record belongs to.
 *
 * Today and Yesterday stay one tap, because they're almost every use and the
 * reason logging gets done at all. The date field behind them is for the tail —
 * the session you meant to log before a trip swallowed the week. Replacing the
 * chips with a bare date field would make the common case slower to serve the
 * rare one.
 *
 * Future dates are refused: a log is a record of something that happened.
 */
import { addDays, daysBetween, fromDateInputValue, now, toDateInputValue } from '@tfc/core';
import type { Dispatch, SetStateAction } from 'react';
import { OptionChips, type ChipOption } from './OptionChips';

/** How far back the picker will go. Beyond this it's history, not logging. */
export const MAX_BACKDATE_DAYS = 365;

type Quick = 'today' | 'yesterday';

const QUICK_OPTIONS: ChipOption<Quick>[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
];

interface Props {
  /** The selected day, as epoch ms. */
  value: number;
  onChange: Dispatch<SetStateAction<number>>;
  disabled?: boolean;
}

export function DayPicker({ value, onChange, disabled }: Props) {
  const today = now();
  const offset = daysBetween(value, today); // 0 today, 1 yesterday, …
  const quick: Quick | null = offset === 0 ? 'today' : offset === 1 ? 'yesterday' : null;

  return (
    <div className="flex flex-col gap-2">
      <OptionChips
        options={QUICK_OPTIONS}
        selected={quick}
        onSelect={(v) => onChange(addDays(today, v === 'today' ? 0 : -1))}
      />
      <input
        type="date"
        aria-label="Date"
        className={`w-full rounded-md border px-4 py-2 text-base ${
          quick === null
            ? 'border-primary bg-surface-alt text-text'
            : 'border-border bg-surface-alt text-muted'
        }`}
        value={toDateInputValue(value)}
        max={toDateInputValue(today)}
        min={toDateInputValue(addDays(today, -MAX_BACKDATE_DAYS))}
        disabled={disabled}
        onChange={(e) => {
          const parsed = fromDateInputValue(e.target.value);
          // Ignore a half-typed or out-of-range date rather than jumping the
          // record to some other day while they're still editing.
          if (parsed === null) return;
          const back = daysBetween(parsed, today);
          if (back < 0 || back > MAX_BACKDATE_DAYS) return;
          onChange(parsed);
        }}
      />
    </div>
  );
}
