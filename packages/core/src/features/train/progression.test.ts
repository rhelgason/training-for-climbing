import { workoutById } from '../../content/workouts';
import type { ExerciseLogRecord, SetLog } from '../../db/types';
import { adjustAfterFirstSet, progressWorkout, summarizeSession } from './progression';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23);

let n = 0;
function log(
  workoutId: string,
  daysAgo: number,
  sets: SetLog[],
  extra: Partial<ExerciseLogRecord> = {},
): ExerciseLogRecord {
  n += 1;
  const date = NOW - daysAgo * DAY;
  return { id: `l${n}`, createdAt: date, updatedAt: date, date, workoutId, sets, ...extra };
}
const clean = (loadLb: number, rpe: number, extra: Partial<SetLog> = {}): SetLog => ({
  loadLb,
  rpe,
  completed: true,
  reps: 5,
  ...extra,
});
const failed = (loadLb: number, rpe = 10): SetLog => ({ loadLb, rpe, completed: false, reps: 3 });

const maxHang = workoutById('max-hang-10')!;

describe('progressWorkout — load', () => {
  it('adds a step when every set was clean and under target RPE', () => {
    const t = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 3, [clean(25, 8), clean(25, 8), clean(25, 8.5)], { edgeMm: 20 })],
    });
    expect(t.kind).toBe('progress');
    expect(t.loadLb).toBe(30);
    expect(t.edgeMm).toBe(20);
    expect(t.because).toMatch(
      /Last time \(3 days ago\): \+25 lb on 20 mm, all 3 sets clean, top RPE 8\.5/,
    );
    expect(t.because).toMatch(/Today: \+30 lb/);
    expect(t.label).toMatch(/^\+30 lb · 20 mm half crimp · 3 × 5 × 10 s on \/ 180 s off$/);
  });

  it('holds after one clean session at the target RPE, progresses after two', () => {
    const once = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 3, [clean(30, 9), clean(30, 9)])],
    });
    expect(once.kind).toBe('hold');
    expect(once.loadLb).toBe(30);

    const twice = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [
        log('max-hang-10', 3, [clean(30, 9), clean(30, 9)]),
        log('max-hang-10', 7, [clean(30, 9), clean(30, 9.5)]),
      ],
    });
    expect(twice.kind).toBe('progress');
    expect(twice.loadLb).toBe(35);
    expect(twice.because).toMatch(/twice running/);
  });

  it('holds when sets were clean but harder than the target', () => {
    const t = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 2, [clean(30, 10), clean(30, 10)])],
    });
    expect(t.kind).toBe('hold');
    expect(t.loadLb).toBe(30);
  });

  it('holds after one failed set and backs off after repeated failure', () => {
    const once = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 2, [clean(35, 9), clean(35, 9.5), failed(35)])],
    });
    expect(once.kind).toBe('hold');
    expect(once.loadLb).toBe(35);

    const again = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [
        log('max-hang-10', 2, [clean(35, 9), clean(35, 9.5), failed(35)]),
        log('max-hang-10', 6, [clean(35, 9), clean(35, 9.5), failed(35)]),
      ],
    });
    expect(again.kind).toBe('backoff');
    expect(again.loadLb).toBe(30);
  });

  it('backs off after pain, whatever the RPE', () => {
    const t = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 2, [clean(30, 7), clean(30, 7)], { pain: true })],
    });
    expect(t.kind).toBe('backoff');
    expect(t.loadLb).toBe(25);
    expect(t.advice).toMatch(/first twinge/);
  });

  it('starts a step back after six weeks away and retests after six months', () => {
    const away = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 50, [clean(30, 8), clean(30, 8)])],
    });
    expect(away.kind).toBe('backoff');
    expect(away.loadLb).toBe(25);

    const long = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('max-hang-10', 200, [clean(30, 8)])],
    });
    expect(long.kind).toBe('test');
  });

  it('flags a stall after three sessions without a gain', () => {
    const t = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [
        log('max-hang-10', 2, [clean(30, 9.5)]),
        log('max-hang-10', 6, [clean(30, 10)]),
        log('max-hang-10', 10, [clean(30, 10)]),
        log('max-hang-10', 14, [clean(30, 9)]),
      ],
    });
    expect(t.stalled).toBe(true);
    expect(t.advice).toMatch(/7-53/);
  });

  it('makes the session a test with nothing logged and no benchmark', () => {
    const t = progressWorkout(maxHang, { nowMs: NOW, logs: [] });
    expect(t.kind).toBe('test');
    expect(t.loadLb).toBe(0);
    expect(t.because).toMatch(/add 5 lb each set/);
  });

  it('starts from an older benchmark when nothing is logged yet', () => {
    const t = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [],
      benchmarks: [
        {
          id: 'b1',
          createdAt: NOW - 5 * DAY,
          date: NOW - 5 * DAY,
          testId: 'protocol-max-weight-hang',
          value: 40,
        },
        {
          id: 'b2',
          createdAt: NOW - 9 * DAY,
          date: NOW - 9 * DAY,
          testId: 'protocol-max-weight-hang',
          value: 40,
        },
      ],
    });
    expect(t.kind).toBe('hold');
    expect(t.loadLb).toBe(40);
  });

  it('ignores logs for other workouts', () => {
    const t = progressWorkout(maxHang, {
      nowMs: NOW,
      logs: [log('weighted-pullups', 2, [clean(45, 7)])],
    });
    expect(t.kind).toBe('test');
  });
});

describe('progressWorkout — other metrics', () => {
  it('shrinks the edge for min-edge hangs and stops at 10 mm with the book advice', () => {
    const w = workoutById('min-edge-hangs')!;
    const t = progressWorkout(w, {
      nowMs: NOW,
      logs: [log('min-edge-hangs', 3, [clean(0, 8), clean(0, 8)], { edgeMm: 14 })],
    });
    expect(t.kind).toBe('progress');
    expect(t.edgeMm).toBe(12);

    const floor = progressWorkout(w, {
      nowMs: NOW,
      logs: [log('min-edge-hangs', 3, [clean(0, 8), clean(0, 8)], { edgeMm: 10 })],
    });
    expect(floor.kind).toBe('hold');
    expect(floor.edgeMm).toBe(10);
    expect(floor.advice).toMatch(/max-weight hangs/);
  });

  it('moves repeaters up a level and adds weight past L4', () => {
    const w = workoutById('repeaters-short')!;
    const t = progressWorkout(w, {
      nowMs: NOW,
      logs: [log('repeaters-short', 3, [clean(0, 7), clean(0, 7.5), clean(0, 8)], { level: 2 })],
    });
    expect(t.level).toBe(3);
    expect(t.label).toMatch(/L3/);
    expect(t.label).toMatch(/10 s on \/ 10 s off/);

    const top = progressWorkout(w, {
      nowMs: NOW,
      logs: [log('repeaters-short', 3, [clean(0, 7), clean(0, 7.5), clean(0, 8)], { level: 4 })],
    });
    expect(top.level).toBe(4);
    expect(top.advice).toMatch(/10 lb/);
  });

  it('adds one pull-up per interval', () => {
    const w = workoutById('pullup-intervals')!;
    const sets = Array.from({ length: 20 }, () => ({ reps: 5, completed: true, rpe: 7 }));
    const t = progressWorkout(w, { nowMs: NOW, logs: [log('pullup-intervals', 2, sets)] });
    expect(t.reps).toBe(6);
    expect(t.label).toMatch(/6 per minute × 20/);
  });

  it('adds a set for campus laddering up to 10', () => {
    const w = workoutById('campus-ladder')!;
    const sets = Array.from({ length: 4 }, () => ({ completed: true, rpe: 7 }));
    const t = progressWorkout(w, { nowMs: NOW, logs: [log('campus-ladder', 3, sets)] });
    expect(t.sets).toBe(5);
  });

  it('asks for a harder 4×4 problem once every lap goes', () => {
    const w = workoutById('bouldering-4x4')!;
    const sets = Array.from({ length: 4 }, () => ({ reps: 4, completed: true, rpe: 8.5 }));
    const t = progressWorkout(w, {
      nowMs: NOW,
      logs: [log('bouldering-4x4', 4, sets, { grade: 'V4–V5' })],
    });
    expect(t.kind).toBe('progress');
    expect(t.advice).toMatch(/a grade harder/);
  });
});

describe('summarizeSession', () => {
  it('reads unrated clean sessions as unrated, so the plan asks for an RPE', () => {
    const s = summarizeSession(maxHang, log('max-hang-10', 1, [{ loadLb: 20, completed: true }]));
    expect(s.outcome).toBe('unrated');
    const t = progressWorkout(maxHang, { nowMs: NOW, logs: [s.log] });
    expect(t.kind).toBe('hold');
    expect(t.because).toMatch(/rate each set/);
  });
});

describe('adjustAfterFirstSet', () => {
  it('drops a step when set 1 fails and adds one when it is easy', () => {
    expect(adjustAfterFirstSet(maxHang, { loadLb: 30 }, failed(30))?.loadLb).toBe(25);
    expect(adjustAfterFirstSet(maxHang, { loadLb: 30 }, clean(30, 7))?.loadLb).toBe(35);
    expect(adjustAfterFirstSet(maxHang, { loadLb: 30 }, clean(30, 8.5))).toBeNull();
  });
});
