/**
 * A journal sentence like "I'm fully resting tomorrow" is about one calendar
 * day — the day after that entry — not about every day that follows.
 *
 * It never schedules a rest. Unlogged days are already rest, and naming one
 * (including "that rest is today") is not a reason to take another day off.
 * The sentence is only here so the coach can be told not to honour it again.
 */
import type { JournalEntry } from '../../db/types';
import { dayIndex } from '../../lib/day';
import type { LoadEvent } from './load';

export interface AnnouncedRest {
  quote: string;
  writtenDaysAgo: number;
  /** 0 = today, 1 = yesterday, negative = still in the future. */
  targetDaysAgo: number;
  /** The target day had no training logged, so the rest happened. */
  taken: boolean;
  /** The sentence is about today, and today is not already a training day. */
  dueToday: boolean;
}

const PATTERNS: { pattern: RegExp; offset: number }[] = [
  { pattern: /\b(?:fully\s+)?rest(?:ing)?\b[^.]{0,40}\btomorrow\b/i, offset: 1 },
  { pattern: /\btomorrow\b[^.]{0,40}\b(?:is\s+)?(?:a\s+)?(?:full\s+)?rest\b/i, offset: 1 },
  { pattern: /\b(?:take|taking)\s+tomorrow\s+off\b/i, offset: 1 },
  { pattern: /\bday\s+off\s+tomorrow\b/i, offset: 1 },
  { pattern: /\b(?:fully\s+)?rest(?:ing)?\b[^.]{0,40}\btoday\b/i, offset: 0 },
  { pattern: /\btoday\b[^.]{0,40}\b(?:is\s+)?(?:a\s+)?rest(?:\s+day)?\b/i, offset: 0 },
  { pattern: /\b(?:take|taking)\s+today\s+off\b/i, offset: 0 },
];

function prose(journal: JournalEntry): string {
  return [journal.summary, journal.wins, journal.struggles].filter(Boolean).join('. ');
}

function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 24), index);
  return /\b(not|no|never|won't|wont|don't|dont|didn't|didnt)\b/i.test(before);
}

function trained(history: LoadEvent[], day: number): boolean {
  const event = history.find((e) => e.day === day);
  return Boolean(event && event.focuses.some((f) => f !== 'rest'));
}

function when(daysAgo: number): string {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo === -1) return 'tomorrow';
  if (daysAgo < 0) return `in ${-daysAgo} days`;
  return `${daysAgo} days ago`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Every rest the journals announce, newest entry first. */
export function resolveAnnouncedRests(
  journals: JournalEntry[],
  history: LoadEvent[],
  nowMs: number,
): AnnouncedRest[] {
  const today = dayIndex(nowMs);
  const found: AnnouncedRest[] = [];
  for (const journal of journals) {
    const text = prose(journal);
    if (!text) continue;
    const writtenDay = dayIndex(journal.date);
    for (const { pattern, offset } of PATTERNS) {
      const match = pattern.exec(text);
      if (!match || negated(text, match.index)) continue;
      const targetDay = writtenDay + offset;
      const targetDaysAgo = today - targetDay;
      found.push({
        quote: match[0].replace(/\s+/g, ' ').trim(),
        writtenDaysAgo: today - writtenDay,
        targetDaysAgo,
        taken: targetDaysAgo > 0 && !trained(history, targetDay),
        dueToday: targetDaysAgo === 0 && !trained(history, today),
      });
      break;
    }
  }
  return found.sort((a, b) => a.writtenDaysAgo - b.writtenDaysAgo);
}

/**
 * What the coach and the "why" line must see, so a named rest is not prescribed
 * again — including when the sentence is about today.
 */
export function announcedRestSummary(rests: AnnouncedRest[]): string {
  const lines = rests.slice(0, 2).map((r) => {
    const wrote = `${capitalise(when(r.writtenDaysAgo))} you wrote "${r.quote}"`;
    if (r.targetDaysAgo === 0) {
      return `${wrote}, which is about today. Naming a rest does not schedule one. Do not take the day off because of that sentence.`;
    }
    if (r.targetDaysAgo > 0 && r.taken) {
      return `${wrote}, which was about ${when(r.targetDaysAgo)}. Nothing was logged that day, so that rest is already taken. Do not rest today because of it.`;
    }
    if (r.targetDaysAgo > 0) {
      return `${wrote}, which was about ${when(r.targetDaysAgo)}. You trained that day, so it is not an open rest.`;
    }
    return `${wrote}, which is about ${when(r.targetDaysAgo)}, not today.`;
  });
  return lines.join(' ');
}
