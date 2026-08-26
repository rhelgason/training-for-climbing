/**
 * Which day a record belongs to — the mobile counterpart of the web DayPicker.
 *
 * Same reasoning: Today and Yesterday stay one tap because that's nearly every
 * use, with a stepper behind them for the tail. The stepper rather than a
 * calendar modal is deliberate — React Native has no built-in date picker, and
 * a new native dependency to backdate the occasional session is a bad trade
 * when ◀ ▶ covers it in a couple of taps.
 *
 * Future dates are refused: a log is a record of something that happened.
 */
import { addDays, daysBetween, now } from '@tfc/core';
import React, { type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';
import { OptionChips, type ChipOption } from './OptionChips';

/** How far back the picker will go. Beyond this it's history, not logging. */
export const MAX_BACKDATE_DAYS = 365;

type Quick = 'today' | 'yesterday';

const QUICK_OPTIONS: ChipOption<Quick>[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
];

function label(ms: number, today: number): string {
  const offset = daysBetween(ms, today);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface Props {
  /** The selected day, as epoch ms. */
  value: number;
  /**
   * A state setter, not a plain callback. The arrows step *relative* to the
   * current day, and React batches rapid taps — computing from the `value`
   * prop would read the same stale day five times and move one day instead of
   * five. Someone backdating a week taps this repeatedly, so that matters.
   */
  onChange: Dispatch<SetStateAction<number>>;
  disabled?: boolean;
}

export function DayPicker({ value, onChange, disabled }: Props) {
  const today = now();
  const offset = daysBetween(value, today);
  const quick: Quick | null = offset === 0 ? 'today' : offset === 1 ? 'yesterday' : null;
  const canGoBack = offset < MAX_BACKDATE_DAYS;
  const canGoForward = offset > 0;

  return (
    <View style={styles.wrapper}>
      <OptionChips
        options={QUICK_OPTIONS}
        selected={quick}
        onSelect={(v) => onChange(addDays(today, v === 'today' ? 0 : -1))}
        testIDPrefix="when"
      />
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Earlier day"
          disabled={disabled || !canGoBack}
          onPress={() =>
            onChange((prev) => {
              const next = addDays(prev, -1);
              return daysBetween(next, now()) > MAX_BACKDATE_DAYS ? prev : next;
            })
          }
          style={[styles.arrow, (disabled || !canGoBack) && styles.arrowDisabled]}
          testID="day-earlier"
        >
          <Text style={styles.arrowText}>◀</Text>
        </Pressable>
        <Text style={styles.dateLabel} testID="day-label">
          {label(value, today)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Later day"
          disabled={disabled || !canGoForward}
          onPress={() =>
            onChange((prev) => {
              const next = addDays(prev, 1);
              // Clamp here as well as via `disabled`: the bound has to hold
              // within a batch, where `disabled` is still a render behind.
              return daysBetween(next, now()) < 0 ? prev : next;
            })
          }
          style={[styles.arrow, (disabled || !canGoForward) && styles.arrowDisabled]}
          testID="day-later"
        >
          <Text style={styles.arrowText}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  arrow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '700' },
  dateLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
});
