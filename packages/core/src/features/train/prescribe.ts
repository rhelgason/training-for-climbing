/**
 * Turning a baseline into today's numbers.
 *
 * The scheduler decides *what* to train and the exercise library decides *which
 * exercise*; this decides **how much**. It exists so a fingerboard step reads
 * "5 sets · 10 s hang · +25 lb · 3 min rest" instead of "do some hangs", without
 * a language model ever doing arithmetic on a weight.
 *
 * The safety rules are invariants, not suggestions, and they're tested:
 *
 *  1. **Never prescribe above what the climber has actually done.** Every target
 *     is a percentage of their own logged baseline, so the app cannot invent a
 *     load they've never held.
 *  2. **Round down to the protocol's own increment.** Half a plate does not
 *     exist on a harness, and rounding up is the direction that hurts.
 *  3. **Less confidence means less load.** A single unconfirmed session gets a
 *     smaller fraction than a well-established one, and stale data gets less
 *     again plus a retest.
 *  4. **No baseline means no number.** The session becomes the test instead —
 *     which is the honest answer, and also exactly how you'd bootstrap it by
 *     hand.
 */
import { formatProtocolValue, protocolById, type TrackableProtocol } from '../../content/protocols';
import type { BenchmarkRecord } from '../../db/types';
import { resolveBaseline, type Baseline, type BaselineConfidence } from './baseline';

/**
 * Fraction of baseline to work at, by how much the baseline is trusted.
 * Monotone on purpose: confidence only ever buys you more load.
 */
const INTENSITY: Record<Exclude<BaselineConfidence, 'none'>, number> = {
  provisional: 0.85,
  established: 0.9,
  stale: 0.8,
};

export type PrescriptionKind =
  /** Establish the baseline — today's session is the measurement. */
  | 'test'
  /** Work at a number derived from the baseline. */
  | 'work'
  /** Dosage guidance with no number to chase. */
  | 'general';

export interface ProtocolPrescription {
  protocolId: string;
  kind: PrescriptionKind;
  /** The number to hit, in the protocol's unit. Null for `test` and `general`. */
  target: number | null;
  /** `target` rendered for display, e.g. "+25 lb". Null when there's no target. */
  targetLabel: string | null;
  /** Sets, work, and rest — the part that doesn't depend on the baseline. */
  dosage: string;
  /** The whole thing as one line, ready to append to a plan step. */
  text: string;
  /** Where the number came from, in plain language. */
  because: string;
  confidence: BaselineConfidence;
}

interface Dosage {
  /** Sets/work/rest for a normal working session. */
  work: string;
  /** How to find the number when there's no baseline yet. */
  test: string;
  /** Guidance for `general` protocols, which never get a target. */
  general?: string;
}

/**
 * Per-protocol dosage. Only protocols the plan is allowed to prescribe need an
 * entry; anything else is `track` and never reaches here.
 *
 * Source (maintainers only): Eric J. Hörst, *Training for Climbing* (3rd ed.) —
 * fingerboard protocols Tables 8.2–8.4, repeaters 8.6–8.7.
 */
const DOSAGE: Record<string, Dosage> = {
  'protocol-max-weight-hang': {
    work: '5 sets · 10 s hang · 3 min rest',
    test: 'Work up in small jumps: 10 s hangs, 3 min rest, adding weight until a hang gets hard but stays clean. Stop the moment your form breaks — that last good hang is your number.',
  },
  'protocol-repeaters-level': {
    work: '6 sets · 7 s on / 3 s off × 6 reps · 3 min rest between sets',
    test: 'Start at L1 (10 s on / 30 s off) and hold the level where you can finish every set with the last rep still clean. That level is your number.',
  },
  'protocol-moving-hang-seconds': {
    work: '4 sets · 2 min rest',
    test: 'One set, moving between holds, until the grip starts to open. Time it — that time is your number.',
  },
  'protocol-arc-minutes': {
    work: '',
    test: '',
    general:
      'Continuous easy traversing or laps at RPE 4–6 — pumped enough to feel it, never enough to have to stop. 20–30 minutes is the useful range.',
  },
};

/** Round toward the safe side: down for load, up for an edge size. */
function roundToStep(value: number, protocol: TrackableProtocol): number {
  const step = protocol.step > 0 ? protocol.step : 1;
  const rounded = protocol.lowerIsBetter
    ? Math.ceil(value / step) * step
    : Math.floor(value / step) * step;
  return rounded;
}

function agePhrase(baseline: Baseline): string {
  if (baseline.daysOld === null) return '';
  if (baseline.daysOld === 0) return 'today';
  if (baseline.daysOld === 1) return 'yesterday';
  if (baseline.daysOld < 14) return `${baseline.daysOld} days ago`;
  return `${Math.round(baseline.daysOld / 7)} weeks ago`;
}

/**
 * Today's prescription for one protocol, or null when the plan has no business
 * prescribing it (`track` protocols — barbell work and the rest).
 */
export function prescribeProtocol(
  protocolId: string,
  benchmarks: BenchmarkRecord[],
  nowMs: number,
): ProtocolPrescription | null {
  const protocol = protocolById(protocolId);
  if (!protocol || protocol.prescription === 'track') return null;

  const dosage = DOSAGE[protocolId];
  if (!dosage) return null;

  if (protocol.prescription === 'general') {
    return {
      protocolId,
      kind: 'general',
      target: null,
      targetLabel: null,
      dosage: dosage.general ?? '',
      text: dosage.general ?? '',
      because: 'Effort here is judged by feel, not by a number.',
      confidence: 'none',
    };
  }

  const baseline = resolveBaseline(protocolId, benchmarks, nowMs);

  if (baseline.confidence === 'none' || baseline.value === null) {
    return {
      protocolId,
      kind: 'test',
      target: null,
      targetLabel: null,
      dosage: dosage.test,
      text: `${protocol.name} — establish your baseline. ${dosage.test}`,
      because: `No recent ${protocol.name.toLowerCase()} on record, so today measures instead of guessing.`,
      confidence: 'none',
    };
  }

  const raw = baseline.value * INTENSITY[baseline.confidence];
  // Invariant 1: never above their own logged best, whatever the rounding does.
  const target = protocol.lowerIsBetter
    ? Math.max(roundToStep(raw, protocol), baseline.value)
    : Math.min(roundToStep(raw, protocol), baseline.value);
  const targetLabel = formatProtocolValue(protocol, target);
  const percent = Math.round(INTENSITY[baseline.confidence] * 100);
  const baselineLabel = formatProtocolValue(protocol, baseline.value);

  const because =
    baseline.confidence === 'stale'
      ? `${percent}% of ${baselineLabel} from ${agePhrase(baseline)} — held back because that's a while ago. Worth retesting soon.`
      : baseline.confidence === 'provisional'
        ? `${percent}% of ${baselineLabel} from ${agePhrase(baseline)} — one session so far, so this stays cautious.`
        : `${percent}% of ${baselineLabel}, your best of ${baseline.samples} recent sessions.`;

  return {
    protocolId,
    kind: 'work',
    target,
    targetLabel,
    dosage: dosage.work,
    text: `${protocol.name} — ${targetLabel} · ${dosage.work}`,
    because,
    confidence: baseline.confidence,
  };
}
