import { workoutById } from '../../content/workouts';
import {
  buildPhases,
  displaySeconds,
  phaseAt,
  setStartMs,
  shouldBeep,
  skipTarget,
  totalMs,
} from './timer';

describe('interval timer', () => {
  const spec = workoutById('max-hang-7-53')!.intervals!({ sets: 2 });
  const phases = buildPhases(spec, 10);

  it('runs 7 on / 53 off with set rest between sets and nothing after the last hang', () => {
    expect(phases.map((p) => `${p.kind}:${p.durationMs / 1000}`)).toEqual([
      'prep:10',
      'work:7',
      'rest:53',
      'work:7',
      'rest:53',
      'work:7',
      'setRest:300',
      'work:7',
      'rest:53',
      'work:7',
      'rest:53',
      'work:7',
    ]);
    expect(totalMs(phases)).toBe((10 + 6 * 7 + 4 * 53 + 300) * 1000);
  });

  it('finds the phase for an elapsed time', () => {
    expect(phaseAt(phases, 0).phase?.kind).toBe('prep');
    const hang = phaseAt(phases, 12_500);
    expect(hang.phase?.kind).toBe('work');
    expect(hang.remainingMs).toBe(4_500);
    expect(phaseAt(phases, 17_000).phase?.kind).toBe('rest');
    expect(phaseAt(phases, totalMs(phases)).done).toBe(true);
  });

  it('skips to the next phase and the next set', () => {
    expect(skipTarget(phases, 3_000)).toBe(10_000);
    const set2 = setStartMs(phases, 1);
    expect(phaseAt(phases, set2).phase).toMatchObject({ kind: 'work', set: 1, rep: 0 });
  });

  it('takes repeater rest from the level', () => {
    const repeaters = workoutById('repeaters-short')!;
    const l3 = buildPhases(repeaters.intervals!({ sets: 1, level: 3 }), 0);
    expect(l3.filter((p) => p.kind === 'rest').every((p) => p.durationMs === 10_000)).toBe(true);
    expect(l3.filter((p) => p.kind === 'work')).toHaveLength(6);
  });

  it('beeps on the last three seconds of rest only', () => {
    expect(shouldBeep(3_100, 2_900, 'rest')).toBe('tick');
    expect(shouldBeep(5_100, 4_900, 'rest')).toBeNull();
    expect(shouldBeep(2_100, 1_900, 'work')).toBeNull();
    expect(displaySeconds(100)).toBe(1);
    expect(displaySeconds(0)).toBe(0);
  });
});
