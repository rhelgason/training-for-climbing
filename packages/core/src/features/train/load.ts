/**
 * Recent-load classification — "what did this climber actually stress, and how
 * long ago?"
 *
 * Everything downstream (the microcycle scheduler, the daily plan, the AI
 * coach's context) depends on answering that honestly. Two sources feed it, in
 * order of trust:
 *
 *  1. **Recorded focus** — `JournalEntry.focus`, written when the day's
 *     prescribed plan is marked done. Exact, because the app chose it.
 *  2. **Inference** — activity tags + intensity, for days logged by hand.
 *     Deliberately *conservative*: when a day is ambiguous we assume the more
 *     recovery-hungry load, so the scheduler errs toward rest rather than
 *     stacking two hard finger days.
 *
 * Pure and unit-testable. No I/O.
 */
import type { ActivityTag, JournalIntensity } from '../../content/journal';
import type { SessionFocusId } from '../../content/trainingContext';
import { sessionFocus } from '../../content/trainingContext';
import type { ClimbRecord, JournalEntry } from '../../db/types';
import { dayIndex } from './log';

/** One day's worth of applied training stress. */
export interface LoadEvent {
  /** Calendar-day index (see `dayIndex`). */
  day: number;
  /** The day's raw timestamp, kept for display. */
  date: number;
  focuses: SessionFocusId[];
  intensity: JournalIntensity;
  /** True when the focus came from a recorded plan rather than inference. */
  recorded: boolean;
}

/** A recent day, flattened for the coach prompt and the "why" line in the UI. */
export interface RecentDay {
  date: number;
  /** 0 = today, 1 = yesterday, … */
  daysAgo: number;
  focuses: SessionFocusId[];
  focusLabels: string[];
  intensity: JournalIntensity;
  activities: ActivityTag[];
  summary?: string;
  wins?: string;
  struggles?: string;
  /** Prescribed steps the climber didn't get to that day. */
  skipped: string[];
  /** Climbs logged that day, summarised (e.g. "V6 send, V7 attempt"). */
  climbs: string[];
}

const DEFAULT_INTENSITY: JournalIntensity = 'moderate';

/**
 * Map one activity tag at a given intensity onto the load it applies.
 *
 * The conservative bias is deliberate: hard climbing is treated as max-strength
 * work because limit bouldering is the common case and it is the costliest
 * assumption to get wrong.
 */
function focusesForActivity(activity: ActivityTag, intensity: JournalIntensity): SessionFocusId[] {
  switch (activity) {
    case 'climbing':
      if (intensity === 'hard') return ['maxStrength', 'skill'];
      if (intensity === 'easy') return ['enduranceAerobic', 'skill'];
      return ['skill'];
    case 'fingerboard':
      if (intensity === 'hard') return ['maxStrength'];
      if (intensity === 'easy') return ['conditioning'];
      return ['powerEndurance'];
    case 'strength':
      return intensity === 'hard' ? ['maxStrength'] : ['conditioning'];
    case 'cardio':
      return ['enduranceAerobic'];
    case 'mobility':
      return ['conditioning'];
    case 'rest':
      return ['rest'];
    case 'other':
    default:
      return [];
  }
}

/**
 * The focuses a journal entry represents. Recorded focus wins; otherwise infer
 * from the tags. A day with only `rest` stays 'rest'.
 */
export function inferJournalFocuses(journal: JournalEntry): SessionFocusId[] {
  if (journal.focus && journal.focus.length > 0) return [...journal.focus];
  const intensity = journal.intensity ?? DEFAULT_INTENSITY;
  const out = new Set<SessionFocusId>();
  for (const activity of journal.activities) {
    for (const focus of focusesForActivity(activity, intensity)) out.add(focus);
  }
  // "Rest" alongside real work means the work happened; drop the rest marker.
  if (out.size > 1) out.delete('rest');
  return [...out];
}

/**
 * Every day of applied load, newest first. Journals are authoritative for a
 * day; climbs logged on a day with no journal count as a skill/climbing day.
 */
export function loadHistory(journals: JournalEntry[], climbs: ClimbRecord[]): LoadEvent[] {
  const byDay = new Map<number, LoadEvent>();

  for (const journal of journals) {
    const day = dayIndex(journal.date);
    const focuses = inferJournalFocuses(journal);
    if (focuses.length === 0) continue;
    const existing = byDay.get(day);
    const event: LoadEvent = {
      day,
      date: journal.date,
      focuses,
      intensity: journal.intensity ?? DEFAULT_INTENSITY,
      recorded: Boolean(journal.focus && journal.focus.length > 0),
    };
    // Two entries for one day: union the load and keep the harder intensity.
    byDay.set(day, existing ? mergeEvents(existing, event) : event);
  }

  for (const climb of climbs) {
    const day = dayIndex(climb.date);
    const existing = byDay.get(day);
    if (existing) continue; // the journal already describes this day
    byDay.set(day, {
      day,
      date: climb.date,
      focuses: ['skill'],
      intensity: DEFAULT_INTENSITY,
      recorded: false,
    });
  }

  return [...byDay.values()].sort((a, b) => b.day - a.day);
}

const INTENSITY_RANK: Record<JournalIntensity, number> = { easy: 0, moderate: 1, hard: 2 };

function mergeEvents(a: LoadEvent, b: LoadEvent): LoadEvent {
  const union = new Set([...a.focuses, ...b.focuses]);
  // Real work on the same day as a rest marker means the day wasn't a rest day.
  if (union.size > 1) union.delete('rest');
  return {
    day: a.day,
    date: Math.min(a.date, b.date),
    focuses: [...union],
    intensity:
      INTENSITY_RANK[a.intensity] >= INTENSITY_RANK[b.intensity] ? a.intensity : b.intensity,
    recorded: a.recorded || b.recorded,
  };
}

/** Load events within the last `days` calendar days (today inclusive). */
export function recentLoad(history: LoadEvent[], nowMs: number, days: number): LoadEvent[] {
  const today = dayIndex(nowMs);
  return history.filter((e) => today - e.day >= 0 && today - e.day < days);
}

/** How many days ago this focus was last trained, or null if never (in history). */
export function daysSinceFocus(
  history: LoadEvent[],
  focus: SessionFocusId,
  nowMs: number,
): number | null {
  const today = dayIndex(nowMs);
  const days = history
    .filter((e) => e.focuses.includes(focus) && e.day <= today)
    .map((e) => today - e.day);
  return days.length > 0 ? Math.min(...days) : null;
}

/** Sessions of this focus in the rolling 7 days ending today. */
export function countFocusInWeek(
  history: LoadEvent[],
  focus: SessionFocusId,
  nowMs: number,
): number {
  return recentLoad(history, nowMs, 7).filter((e) => e.focuses.includes(focus)).length;
}

/** True when the day applied a high-intensity load. */
export function isHardDay(event: LoadEvent): boolean {
  return (
    event.intensity === 'hard' || event.focuses.some((f) => sessionFocus(f).intensity === 'high')
  );
}

/** Consecutive days ending today that applied a hard load. */
export function consecutiveHardDays(history: LoadEvent[], nowMs: number): number {
  const hardDays = new Set(history.filter(isHardDay).map((e) => e.day));
  let day = dayIndex(nowMs);
  let count = 0;
  while (hardDays.has(day)) {
    count += 1;
    day -= 1;
  }
  return count;
}

/**
 * The run of hard days the climber arrives at today *with* — the question a
 * plan actually has to answer.
 *
 * `consecutiveHardDays` counts from today, so before today is logged it always
 * returns 0. That makes it useless for deciding whether to train: it can only
 * tell you to rest after you already trained. This counts the run ending
 * yesterday instead, and only includes today if today is already on the books
 * (someone logging mid-session and reopening the app).
 */
export function priorHardDayRun(history: LoadEvent[], nowMs: number): number {
  const hardDays = new Set(history.filter(isHardDay).map((e) => e.day));
  const today = dayIndex(nowMs);
  let day = hardDays.has(today) ? today : today - 1;
  let count = 0;
  while (hardDays.has(day)) {
    count += 1;
    day -= 1;
  }
  return count;
}

/**
 * Whole days since the last day with any logged load, or null if there is none.
 * Calendar-based, so a week away from the app reads as a week of rest rather
 * than as "no data".
 */
export function daysSinceAnyLoad(history: LoadEvent[], nowMs: number): number | null {
  const today = dayIndex(nowMs);
  const past = history.filter((e) => e.day <= today && !e.focuses.every((f) => f === 'rest'));
  if (past.length === 0) return null;
  return today - Math.max(...past.map((e) => e.day));
}

/**
 * The last `count` logged days, newest first, with everything the coach needs to
 * reason about "what did I just do to myself". This is the payload that makes
 * yesterday's session visibly shape today's plan.
 */
export function recentDays(
  journals: JournalEntry[],
  climbs: ClimbRecord[],
  nowMs: number,
  count: number,
): RecentDay[] {
  const today = dayIndex(nowMs);
  const history = loadHistory(journals, climbs);
  const journalByDay = new Map(journals.map((j) => [dayIndex(j.date), j]));

  const climbsByDay = new Map<number, ClimbRecord[]>();
  for (const climb of climbs) {
    const day = dayIndex(climb.date);
    climbsByDay.set(day, [...(climbsByDay.get(day) ?? []), climb]);
  }

  return history
    .filter((e) => e.day <= today)
    .slice(0, count)
    .map((event) => {
      const journal = journalByDay.get(event.day);
      return {
        date: event.date,
        daysAgo: today - event.day,
        focuses: event.focuses,
        focusLabels: event.focuses.map((f) => sessionFocus(f).label),
        intensity: event.intensity,
        activities: journal?.activities ?? [],
        summary: journal?.summary,
        wins: journal?.wins,
        struggles: journal?.struggles,
        skipped: journal?.skipped ?? [],
        climbs: (climbsByDay.get(event.day) ?? []).map((c) => `${c.grade} ${c.outcome}`),
      };
    });
}
