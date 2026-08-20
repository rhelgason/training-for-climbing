import { EXERCISES } from './exercises';
import {
  TRACKABLE_PROTOCOLS,
  formatProtocolValue,
  protocolById,
  protocolForExercise,
} from './protocols';

describe('trackable protocols', () => {
  it('only references exercises that exist in the library', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const protocol of TRACKABLE_PROTOCOLS) {
      for (const exerciseId of protocol.exerciseIds) {
        expect({ protocol: protocol.id, exerciseId, known: ids.has(exerciseId) }).toEqual({
          protocol: protocol.id,
          exerciseId,
          known: true,
        });
      }
    }
  });

  it('has unique ids, since they are used as benchmark keys', () => {
    const ids = TRACKABLE_PROTOCOLS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never maps one exercise to two protocols', () => {
    const seen = new Set<string>();
    for (const protocol of TRACKABLE_PROTOCOLS) {
      for (const exerciseId of protocol.exerciseIds) {
        expect(seen.has(exerciseId)).toBe(false);
        seen.add(exerciseId);
      }
    }
  });

  it('resolves a protocol from its exercise and back from its id', () => {
    const protocol = protocolForExercise('fingerboard-repeaters');
    expect(protocol?.id).toBe('protocol-repeaters-level');
    expect(protocolById(protocol!.id)).toBe(protocol);
  });

  it('returns null for exercises with nothing worth tracking', () => {
    expect(protocolForExercise('foam-rolling')).toBeNull();
    expect(protocolById('nope')).toBeNull();
  });

  it('keeps every protocol on a sane, positive step', () => {
    for (const protocol of TRACKABLE_PROTOCOLS) {
      expect(protocol.step).toBeGreaterThan(0);
      expect(protocol.defaultValue).toBeGreaterThanOrEqual(0);
    }
  });

  describe('formatProtocolValue', () => {
    const find = (id: string) => TRACKABLE_PROTOCOLS.find((p) => p.id === id)!;

    it('signs added weight so +0 vs +25 reads correctly', () => {
      expect(formatProtocolValue(find('protocol-max-weight-hang'), 25)).toBe('+25 lb');
      expect(formatProtocolValue(find('protocol-max-weight-hang'), 0)).toBe('0 lb');
    });

    it('renders levels, rungs, and reps in their own vocabulary', () => {
      expect(formatProtocolValue(find('protocol-repeaters-level'), 3)).toBe('L3');
      expect(formatProtocolValue(find('protocol-campus-rung'), 6)).toBe('rung 6');
      expect(formatProtocolValue(find('protocol-pullup-reps'), 12)).toBe('12 reps');
    });

    it('switches long efforts to minutes', () => {
      const arc = find('protocol-arc-minutes');
      expect(formatProtocolValue(arc, 900)).toBe('15 min');
      expect(formatProtocolValue(find('protocol-lock-off-seconds'), 8)).toBe('8 s');
    });
  });
});
