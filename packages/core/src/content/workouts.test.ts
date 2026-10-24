import { EXERCISES } from './exercises';
import { protocolById } from './protocols';
import { WORKOUTS, gripForSet, workoutById, workoutSuitsTier } from './workouts';

describe('workout catalog', () => {
  it.each(WORKOUTS.map((w) => [w.id, w] as const))('%s is well formed', (_id, w) => {
    if (w.exerciseId) expect(EXERCISES.some((e) => e.id === w.exerciseId)).toBe(true);
    if (w.trackableId) expect(protocolById(w.trackableId)).not.toBeNull();
    expect(w.sets[0]).toBeLessThanOrEqual(w.sets[1]);
    expect(w.step).toBeGreaterThan(0);
    expect(w.targetRpe).toBeGreaterThanOrEqual(1);
    expect(w.targetRpe).toBeLessThanOrEqual(10);
    const spec = w.intervals?.({ sets: w.sets[0], level: w.defaults?.level, reps: w.reps });
    if (spec) {
      expect(spec.sets).toBeGreaterThan(0);
      expect(spec.repsPerSet).toBeGreaterThan(0);
      expect(spec.workSec).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    expect(new Set(WORKOUTS.map((w) => w.id)).size).toBe(WORKOUTS.length);
  });

  it('keeps the book numbers for 7-53 and 10 s hangs', () => {
    expect(workoutById('max-hang-7-53')!.intervals!({ sets: 3 })).toMatchObject({
      repsPerSet: 3,
      workSec: 7,
      restSec: 53,
      setRestSec: 300,
    });
    expect(workoutById('max-hang-10')!.intervals!({ sets: 3 })).toMatchObject({
      repsPerSet: 5,
      workSec: 10,
      restSec: 180,
    });
  });

  it('rotates HIT grips in the book order and gates campus switch hands to elite', () => {
    const hit = workoutById('hit-max')!;
    expect([0, 1, 5, 6].map((i) => gripForSet(hit, i))).toEqual([
      'pinch',
      'pocket-back',
      'open-hand',
      'pinch',
    ]);
    const switchHands = workoutById('campus-switch-hands')!;
    expect(workoutSuitsTier(switchHands, 'intermediate')).toBe(false);
    expect(workoutSuitsTier(switchHands, 'elite')).toBe(true);
  });
});
