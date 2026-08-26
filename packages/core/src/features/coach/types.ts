/**
 * Shared types for the AI Coach. The context is what the app sends to its own
 * server (which calls the LLM); the suggestion is the structured reply.
 *
 * The context is deliberately opinionated about division of labour: it carries
 * the **scheduler's verdict** (what may and may not be trained today, and why)
 * alongside the raw facts. The model's job is to write a great session inside
 * those constraints, not to re-derive them — it cannot count a training week
 * reliably, and the app already has.
 */
import type { TriadArea } from '../../content/types';
import type {
  EquipmentId,
  Readiness,
  SessionFocusId,
  SessionLength,
  StyleFocus,
} from '../../content/trainingContext';

/** A recent session, as the coach sees it. */
export interface CoachRecentDay {
  date: number;
  /** 1 = yesterday. The single most important field for today's decision. */
  daysAgo: number;
  /** Human-readable focus labels, e.g. ["Max strength"]. */
  focus: string[];
  intensity: string;
  activities: string[];
  summary?: string;
  wins?: string;
  struggles?: string;
  /** Steps that were prescribed but not done — a direct signal about time and energy. */
  skipped: string[];
  climbs: string[];
}

/** What the scheduler decided, and why. Binding on the model. */
export interface CoachSchedule {
  restDay: boolean;
  restReason?: string;
  /** The focus the deterministic engine chose. The model may pick another *allowed* one. */
  suggestedFocus: SessionFocusId | null;
  /** The only focuses the model may prescribe today. */
  allowed: { focus: SessionFocusId; label: string; reason: string; usedThisWeek: number }[];
  /** Focuses the model must NOT prescribe, each with the reason it's out. */
  blocked: { focus: SessionFocusId; label: string; reason: string }[];
  trainingDaysThisWeek: number;
  plannedDaysPerWeek: number;
  hardDaysInARow: number;
  /** One-line plain-English summary of the last few days. */
  recentLoadSummary: string;
}

/** A compact, privacy-reviewed snapshot of the user's training picture. */
export interface CoachContext {
  /** When the context was assembled (epoch ms). */
  generatedAt: number;
  profile: {
    abilityTier: string;
    styleFocus: StyleFocus;
    daysPerWeek: number;
    sessionLength: SessionLength;
    /** Equipment normally available. */
    equipment: EquipmentId[];
    /** The climber's own words about themselves. Free text, read verbatim. */
    climberContext?: string;
    /**
     * Facts the app inferred and the climber confirmed — kept as a separate
     * list rather than folded into `climberContext` so the model can never
     * mistake its own earlier inference for something the climber said.
     */
    derivedContext?: { text: string; addedAt: number }[];
  };
  /** What's true for *today* specifically, from the daily check-in. */
  today: {
    environment: string;
    equipment: EquipmentId[];
    sessionLength: SessionLength;
    readiness: Readiness;
    note?: string;
  };
  /** The scheduler's binding verdict for today. */
  schedule: CoachSchedule;
  /**
   * The last several days of training, newest first. Explicitly separate from
   * `journals` because recency is what drives today's decision.
   */
  recentDays: CoachRecentDay[];
  assessment: {
    takenAt: number;
    mental: number;
    technical: number;
    physical: number;
    weakestArea: TriadArea;
    /** Specific low-rated statements in the weakest area, worst-first. */
    weakSpots: string[];
  } | null;
  /** Fitness-benchmark highlights: latest value + recent direction. */
  fitness: { test: string; latest: number; trend: 'up' | 'down' | 'flat' | 'new' }[];
  climbing: {
    sessionsLast30Days: number;
    sendRate: number;
    hardestSends: { discipline: string; grade: string }[];
  };
  goals: { horizon: string; title: string }[];
  /** Most recent journal entries (newest first), free text included. */
  journals: {
    date: number;
    activities: string[];
    intensity?: string;
    summary?: string;
    wins?: string;
    struggles?: string;
  }[];
  training: { currentStreak: number; daysLast14: number };
  /** The deterministic plan for today — the floor the model should beat. */
  baselinePlan: string[];
  /**
   * Numbers the app has already computed from the climber's logged history.
   *
   * These are here so the model stops inventing them. A load derived from a
   * measured baseline, bounded by rules the model can't see, is not something
   * it can improve on by guessing — and two different numbers reaching the
   * climber from the same screen is worse than either alone.
   */
  prescriptions: CoachPrescriptions;
}

export interface CoachPrescriptions {
  /** Grades and style for today, or null when there's nothing to pitch against. */
  climbing: {
    style: string;
    /** e.g. "warm up V1 · volume V3 · work V5 · project V6". Empty when unknown. */
    bands: string;
    because: string;
  } | null;
  /**
   * Protocol lines to reproduce verbatim if that work is prescribed. Copying
   * them exactly is also what lets the app re-attach its inline number logger,
   * which matches steps by text.
   */
  protocols: {
    name: string;
    /** The full line, ready to be used as a plan step unchanged. */
    text: string;
    /** The number itself, or null on a test/general day. */
    targetLabel: string | null;
    because: string;
  }[];
}

/** Structured coaching reply. Mirrors the deterministic baseline's shape. */
export interface CoachSuggestion {
  focusArea: TriadArea | null;
  headline: string;
  plan: string[];
  rationale: string;
  watchOuts: string[];
}
