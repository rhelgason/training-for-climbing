/**
 * Current baseline for a trackable protocol — the number today's prescription
 * is allowed to be computed from.
 *
 * The daily plan can only say "hang +25 lb today" if it knows what the climber
 * can actually hang, and the app already has that: every prescribed protocol
 * step writes a `BenchmarkRecord` when the session is logged. This module turns
 * that raw series into one trustworthy number, plus an honest statement of how
 * much to trust it.
 *
 * Two deliberate choices, both about not letting a single session set the load:
 *
 *  - **Three or more samples uses the second-best, not the best.** One fluke —
 *    a day that felt superhuman, or a mis-tapped `+` — should not become the
 *    number every future session is derived from. With only one or two samples
 *    there's nothing to cross-check against, so the best is all there is.
 *  - **Old data decays rather than disappearing.** Finger strength is lost over
 *    months, so a four-month-old max isn't wrong, it's uncertain; it comes back
 *    as `stale` so the caller can prescribe conservatively and ask for a retest
 *    instead of silently pretending nothing is known.
 */
import type { BenchmarkRecord } from '../../db/types';
import { protocolById } from '../../content/protocols';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Inside this window a baseline is current. */
export const FRESH_DAYS = 42;
/** Past this, a baseline is too old to prescribe from at all. */
export const EXPIRY_DAYS = 180;

export type BaselineConfidence =
  /** Nothing usable — the caller should prescribe a test session. */
  | 'none'
  /** A single recent session. Real, but unconfirmed. */
  | 'provisional'
  /** Several recent sessions agree. */
  | 'established'
  /** Old enough that fitness may have moved; prescribe down and retest. */
  | 'stale';

export interface Baseline {
  protocolId: string;
  confidence: BaselineConfidence;
  /** The number to derive from, in the protocol's unit. Null when `none`. */
  value: number | null;
  /** When the chosen value was recorded. Null when `none`. */
  date: number | null;
  /** Records inside the considered window. */
  samples: number;
  /** Age in whole days of the chosen value. Null when `none`. */
  daysOld: number | null;
}

const EMPTY = (protocolId: string): Baseline => ({
  protocolId,
  confidence: 'none',
  value: null,
  date: null,
  samples: 0,
  daysOld: null,
});

/**
 * Order records best-first for a protocol, honouring `lowerIsBetter` so an
 * edge-size protocol ranks a smaller number as the stronger one.
 */
function bestFirst(records: BenchmarkRecord[], lowerIsBetter: boolean): BenchmarkRecord[] {
  return [...records].sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));
}

/**
 * Resolve the baseline for one protocol from the climber's benchmark history.
 *
 * `benchmarks` may contain every test the app records; entries for other
 * protocols are ignored.
 */
export function resolveBaseline(
  protocolId: string,
  benchmarks: BenchmarkRecord[],
  nowMs: number,
): Baseline {
  const protocol = protocolById(protocolId);
  if (!protocol) return EMPTY(protocolId);

  const mine = benchmarks.filter((b) => b.testId === protocolId && b.date <= nowMs);
  if (mine.length === 0) return EMPTY(protocolId);

  const within = (days: number) => mine.filter((b) => nowMs - b.date <= days * MS_PER_DAY);

  // Prefer the fresh window; fall back to the wider one before giving up, so a
  // climber returning from a layoff gets a conservative number rather than
  // being sent back to square one.
  const fresh = within(FRESH_DAYS);
  const usable = fresh.length > 0 ? fresh : within(EXPIRY_DAYS);
  if (usable.length === 0) return EMPTY(protocolId);

  const ranked = bestFirst(usable, Boolean(protocol.lowerIsBetter));
  // Three or more samples: drop the single best so one outlier can't set the load.
  const chosen = ranked.length >= 3 ? ranked[1] : ranked[0];
  const daysOld = Math.floor((nowMs - chosen.date) / MS_PER_DAY);

  const confidence: BaselineConfidence =
    fresh.length === 0 ? 'stale' : usable.length >= 2 ? 'established' : 'provisional';

  return {
    protocolId,
    confidence,
    value: chosen.value,
    date: chosen.date,
    samples: usable.length,
    daysOld,
  };
}
