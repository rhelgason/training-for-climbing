/**
 * Backdating lost its test coverage when the React Native app was retired — the
 * mobile picker was tested, this one never was. Same rules, so they're worth
 * pinning here: no future dates, a bounded past, and a malformed entry left
 * alone rather than jumping the record to some other day mid-keystroke.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addDays, dayIndex, now } from '@tfc/core';
import { DayPicker, MAX_BACKDATE_DAYS } from './DayPicker';

function setup(value: number) {
  const onChange = vi.fn();
  render(<DayPicker value={value} onChange={onChange} />);
  return { onChange, input: screen.getByLabelText('Date') as HTMLInputElement };
}

/** Resolve a state-setter-or-value the way React would. */
function applied(onChange: ReturnType<typeof vi.fn>, previous: number): number {
  const arg = onChange.mock.calls.at(-1)![0];
  return typeof arg === 'function' ? arg(previous) : arg;
}

beforeEach(() => {
  // Pinned: the component reads the wall clock to decide what "today" means.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('DayPicker', () => {
  it('marks Today as selected when the value is today', () => {
    setup(now());
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Yesterday' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks Yesterday as selected when the value is yesterday', () => {
    setup(addDays(now(), -1));
    expect(screen.getByRole('button', { name: 'Yesterday' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('selects neither chip for an older date, so the field reads as the source of truth', () => {
    setup(addDays(now(), -9));
    for (const name of ['Today', 'Yesterday']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('jumps to the chosen day when a chip is tapped', () => {
    const { onChange } = setup(addDays(now(), -20));
    fireEvent.click(screen.getByRole('button', { name: 'Yesterday' }));
    expect(dayIndex(applied(onChange, addDays(now(), -20)))).toBe(dayIndex(now()) - 1);
  });

  it('shows the current value in the date field, in local time', () => {
    const { input } = setup(now());
    expect(input.value).toBe('2026-08-31');
  });

  it('bounds the field to today and the backdate limit', () => {
    const { input } = setup(now());
    expect(input.max).toBe('2026-08-31');
    expect(input.min).toBe(new Date(addDays(now(), -MAX_BACKDATE_DAYS)).toISOString().slice(0, 10));
  });

  it('accepts a date inside the window', () => {
    const { onChange, input } = setup(now());
    fireEvent.change(input, { target: { value: '2026-08-14' } });
    expect(dayIndex(applied(onChange, now()))).toBe(dayIndex(new Date(2026, 7, 14).getTime()));
  });

  it('refuses a future date — a log records something that happened', () => {
    const { onChange, input } = setup(now());
    fireEvent.change(input, { target: { value: '2026-09-05' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a date beyond the backdate limit', () => {
    const { onChange, input } = setup(now());
    fireEvent.change(input, { target: { value: '2020-01-01' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a half-typed date instead of moving the record', () => {
    // Typing a year fires change events on the way; jumping to year 0002 and
    // back would be worse than waiting for something valid.
    const { onChange, input } = setup(now());
    for (const partial of ['', '2026-', '0002-08-14']) {
      fireEvent.change(input, { target: { value: partial } });
    }
    expect(onChange).not.toHaveBeenCalled();
  });
});
