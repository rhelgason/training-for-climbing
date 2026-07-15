/**
 * Single source of "current time". Wrapping `Date.now()` keeps impure time
 * access out of component render paths (satisfying the react-hooks purity rule)
 * and gives one place to mock the clock in tests.
 */
export function now(): number {
  return Date.now();
}
