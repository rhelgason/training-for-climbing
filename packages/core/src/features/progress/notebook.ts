/**
 * The training notebook, summarised: how each logged workout has moved, and
 * whether the climbing itself is getting harder. Feeds the progress page and
 * the coach, so "you've added 15 lb to your hangs in six weeks but your
 * boulder grade hasn't moved" is something both can say.
 */
import {
  DISCIPLINE_LABELS,
  DISCIPLINES,
  type ClimbDiscipline,
  isSend,
} from '../../content/climbing';
import { gradeRank } from '../../content/grades';
import { WORKOUTS, type Workout } from '../../content/workouts';
import type { ClimbRecord, ExerciseLogRecord } from '../../db/types';
import {
  describeSession,
  formatMetric,
  sessionValue,
  summarizeSession,
} from '../train/progression';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back a workout counts as current. */
export const NOTEBOOK_DAYS = 90;

export interface WorkoutPoint {
  date: number;
  value: number;
  /** Every set clean. */
  clean: boolean;
  topRpe: number | null;
}

export interface WorkoutTrend {
  workoutId: string;
  name: string;
  sessions: number;
  /** Metric per session, oldest first, for charts. */
  points: WorkoutPoint[];
  /** "+25 lb on 20 mm, all 3 sets clean, top RPE 8 (3 days ago)". */
  latest: string;
  /** "+15 → +30 lb over 6 weeks", or null with fewer than two numbers. */
  change: string | null;
  direction: 'up' | 'down' | 'flat' | 'new';
  lastDate: number;
}

function weeksBetween(a: number, b: number): string {
  const days = Math.round(Math.abs(b - a) / DAY_MS);
  if (days < 14) return `${days} days`;
  return `${Math.round(days / 7)} weeks`;
}

function better(workout: Workout, a: number, b: number): boolean {
  return workout.metric === 'edge' ? a < b : a > b;
}

/** One trend per workout logged in the last `NOTEBOOK_DAYS`, most recent first. */
export function workoutTrends(logs: ExerciseLogRecord[], nowMs: number): WorkoutTrend[] {
  const since = nowMs - NOTEBOOK_DAYS * DAY_MS;
  const out: WorkoutTrend[] = [];
  for (const workout of WORKOUTS) {
    const mine = logs
      .filter((l) => l.workoutId === workout.id && l.date >= since)
      .sort((a, b) => a.date - b.date);
    if (mine.length === 0) continue;

    const summaries = mine.map((l) => summarizeSession(workout, l));
    const points: WorkoutPoint[] = summaries.flatMap((s) => {
      const value = sessionValue(workout, s.log);
      return value === null
        ? []
        : [
            {
              date: s.log.date,
              value,
              clean: s.cleanSets === s.totalSets,
              topRpe: s.topRpe,
            },
          ];
    });
    const last = summaries[summaries.length - 1];
    const daysAgo = Math.floor((nowMs - last.log.date) / DAY_MS);
    const first = points[0];
    const end = points[points.length - 1];
    let direction: WorkoutTrend['direction'] = 'new';
    let change: string | null = null;
    if (first && end && points.length >= 2) {
      direction = better(workout, end.value, first.value)
        ? 'up'
        : better(workout, first.value, end.value)
          ? 'down'
          : 'flat';
      change = `${formatMetric(workout.metric, first.value)} → ${formatMetric(workout.metric, end.value)} over ${weeksBetween(first.date, end.date)}`;
    }
    out.push({
      workoutId: workout.id,
      name: workout.name,
      sessions: mine.length,
      points,
      latest: `${describeSession(workout, last)} (${daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`})`,
      change,
      direction,
      lastDate: last.log.date,
    });
  }
  return out.sort((a, b) => b.lastDate - a.lastDate);
}

export interface ClimbingTrend {
  discipline: string;
  /** Hardest send in the last 30 days. */
  recent: string | null;
  /** Hardest send in the 60 days before that. */
  before: string | null;
  /** Sends in the last 30 days at or above the previous window's hardest. */
  sendsAtTop: number;
  direction: 'up' | 'down' | 'flat' | 'new';
}

function hardestIn(
  climbs: ClimbRecord[],
  discipline: ClimbDiscipline,
  from: number,
  to: number,
): { grade: string; rank: number } | null {
  let best: { grade: string; rank: number } | null = null;
  for (const c of climbs) {
    if (c.discipline !== discipline || !isSend(c.outcome) || c.date < from || c.date >= to)
      continue;
    const rank = gradeRank(discipline, c.grade);
    if (rank >= 0 && (!best || rank > best.rank)) best = { grade: c.grade, rank };
  }
  return best;
}

/**
 * Is the climbing itself getting harder? Hardest send in the last 30 days
 * against the 60 days before, per discipline with any recent climbing.
 */
export function climbingTrends(climbs: ClimbRecord[], nowMs: number): ClimbingTrend[] {
  const cut = nowMs - 30 * DAY_MS;
  const start = nowMs - 90 * DAY_MS;
  const out: ClimbingTrend[] = [];
  for (const discipline of DISCIPLINES) {
    const recent = hardestIn(climbs, discipline, cut, nowMs + DAY_MS);
    const before = hardestIn(climbs, discipline, start, cut);
    if (!recent && !before) continue;
    const sendsAtTop = before
      ? climbs.filter(
          (c) =>
            c.discipline === discipline &&
            isSend(c.outcome) &&
            c.date >= cut &&
            gradeRank(discipline, c.grade) >= before.rank,
        ).length
      : 0;
    out.push({
      discipline: DISCIPLINE_LABELS[discipline],
      recent: recent?.grade ?? null,
      before: before?.grade ?? null,
      sendsAtTop,
      direction:
        !recent || !before
          ? recent
            ? 'new'
            : 'down'
          : recent.rank > before.rank
            ? 'up'
            : recent.rank < before.rank
              ? 'down'
              : 'flat',
    });
  }
  return out;
}
