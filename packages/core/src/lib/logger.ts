/**
 * Central logging + usage-event abstraction (platform-neutral).
 *
 * This is the shared core version — a thin wrapper over `console` with no
 * React Native dependency. Platform apps (mobile via react-native-logs, web via
 * the browser console) can swap the transport, but the public surface —
 * `log.*`, `trackEvent`, `registerEventSink` — stays identical so feature code
 * is portable.
 *
 * Rules for the codebase:
 *  - Never call `console.log` directly in feature code — use `log.*`.
 *  - Emit structured usage events via `trackEvent(...)` so we can observe usage
 *    patterns. Events are persisted locally (and can later be forwarded to a
 *    remote analytics sink) by registering an `EventSink`.
 *
 * During tests (TFC_TEST=1) logging is silenced to keep output clean.
 */

const isTest =
  typeof process !== 'undefined' &&
  (process.env?.TFC_TEST === '1' || process.env?.NODE_ENV === 'test');

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function make(): Logger {
  if (isTest) {
    const noop = () => {};
    return { debug: noop, info: noop, warn: noop, error: noop };
  }
  /* eslint-disable no-console */
  return {
    debug: (...args) => console.debug(...args),
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  };
  /* eslint-enable no-console */
}

export const log: Logger = make();

/**
 * Strongly-typed catalogue of usage events. Extend this as features land so
 * every emitted event has a known shape.
 */
export type UsageEvent =
  | { name: 'app_opened'; props?: Record<string, never> }
  | { name: 'assessment_started'; props?: Record<string, never> }
  | {
      name: 'assessment_completed';
      props: { mental: number; technical: number; physical: number; weakestArea: string };
    }
  | { name: 'assessment_viewed_history'; props?: Record<string, never> }
  | { name: 'glossary_searched'; props: { query: string; resultCount: number } }
  | { name: 'goal_created'; props: { horizon: string } }
  | { name: 'goal_completed'; props: { horizon: string } }
  | { name: 'goal_deleted'; props: { horizon: string } }
  | { name: 'program_built'; props: { tier: string; areaCount: number } }
  | { name: 'macrocycle_period_created'; props?: Record<string, never> }
  | { name: 'journal_logged'; props: { activityCount: number } }
  | { name: 'journal_deleted'; props?: Record<string, never> }
  | { name: 'checkin_logged'; props: { quadrant: string } }
  | { name: 'benchmark_recorded'; props: { testId: string } }
  | {
      name: 'climb_logged';
      props: { discipline: string; environment: string; grade: string; outcome: string };
    }
  | { name: 'cloud_synced'; props?: Record<string, never> }
  | { name: 'signed_up'; props?: Record<string, never> }
  | { name: 'signed_in'; props?: Record<string, never> }
  | { name: 'signed_out'; props?: Record<string, never> }
  | { name: 'account_deleted'; props?: Record<string, never> }
  | { name: 'coach_feedback'; props: { rating: 'up' | 'down' } }
  | { name: 'onboarding_completed'; props: { goals: number; signedIn: boolean } }
  | { name: 'daily_context_set'; props: { readiness: string; environment: string } }
  | { name: 'plan_completed'; props: { focus: string; kind: string; skipped: number } };

export type EventSink = (event: {
  name: UsageEvent['name'];
  props: Record<string, unknown>;
  timestamp: number;
}) => void;

let sink: EventSink | null = null;

/** Register where usage events are persisted/forwarded (e.g. the local DB). */
export function registerEventSink(next: EventSink | null): void {
  sink = next;
}

/** Emit a structured usage event. Safe to call before a sink is registered. */
export function trackEvent<E extends UsageEvent>(name: E['name'], props?: E['props']): void {
  const event = {
    name,
    props: (props ?? {}) as Record<string, unknown>,
    timestamp: Date.now(),
  };
  if (!isTest) {
    log.debug(`[event] ${name}`, event.props);
  }
  try {
    sink?.(event);
  } catch (err) {
    log.error('event sink failed', err);
  }
}
