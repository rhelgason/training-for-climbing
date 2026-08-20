'use client';

import { useEffect, useState } from 'react';

/**
 * Settle a rapidly-changing value before anything expensive reacts to it.
 *
 * Used for the daily check-in: toggling five equipment chips produces five
 * distinct states in a couple of seconds, and each one would otherwise be a
 * separate call to the coach. Waiting for the taps to stop turns that into one.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
