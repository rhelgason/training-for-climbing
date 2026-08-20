import { EXERCISES } from './exercises';
import { TRAINING_HIERARCHY } from './planning';
import { PRESCRIPTIONS_BY_AREA } from './prescriptions';
import {
  DEFAULT_EQUIPMENT,
  EQUIPMENT_IDS,
  EQUIPMENT_LABELS,
  EQUIPMENT_PRESETS,
  SESSION_FOCUSES,
  TRAINABLE_FOCUSES,
  focusIsPossible,
  missingEquipmentLabel,
  orderByHierarchy,
  sessionFocus,
} from './trainingContext';

describe('the session-focus catalog', () => {
  it('has unique ids', () => {
    const ids = SESSION_FOCUSES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('excludes rest from the trainable set but keeps everything else', () => {
    expect(TRAINABLE_FOCUSES).not.toContain('rest');
    expect(TRAINABLE_FOCUSES).toHaveLength(SESSION_FOCUSES.length - 1);
  });

  it('never sets a weekly target above its own ceiling', () => {
    // A focus that is "due" more often than it is allowed would be permanently
    // in debt, and the scheduler would keep ranking it first.
    for (const focus of SESSION_FOCUSES) {
      if (focus.maxPerWeek === null) continue;
      expect({ id: focus.id, ok: focus.targetPerWeek <= focus.maxPerWeek }).toEqual({
        id: focus.id,
        ok: true,
      });
    }
  });

  it('keeps recovery gaps compatible with the weekly ceiling', () => {
    // maxPerWeek sessions each separated by minDaysBetween must fit in 7 days,
    // otherwise the two rules contradict and the ceiling is unreachable.
    for (const focus of SESSION_FOCUSES) {
      if (focus.maxPerWeek === null || focus.maxPerWeek < 2) continue;
      const spread = (focus.maxPerWeek - 1) * focus.minDaysBetween;
      expect({ id: focus.id, spread, fits: spread <= 7 }).toEqual({
        id: focus.id,
        spread,
        fits: true,
      });
    }
  });

  it('gives every high-intensity focus a real recovery gap', () => {
    for (const focus of SESSION_FOCUSES.filter((f) => f.intensity === 'high')) {
      expect({ id: focus.id, gap: focus.minDaysBetween >= 1 }).toEqual({ id: focus.id, gap: true });
    }
  });

  it('references only real equipment ids and hierarchy areas', () => {
    const hierarchy = new Set(TRAINING_HIERARCHY.map((h) => h.id));
    for (const focus of SESSION_FOCUSES) {
      expect(hierarchy.has(focus.hierarchyAreaId)).toBe(true);
      for (const item of focus.requiresAnyOf) expect(EQUIPMENT_IDS).toContain(item);
    }
  });

  it('throws loudly on an unknown focus rather than returning undefined', () => {
    // Callers index this from persisted data; a silent undefined would surface
    // much later as an unreadable crash.
    expect(() => sessionFocus('nope' as never)).toThrow(/Unknown session focus/);
  });
});

describe('equipment', () => {
  it('labels every id', () => {
    for (const id of EQUIPMENT_IDS) expect(EQUIPMENT_LABELS[id]).toBeTruthy();
  });

  it('only offers presets built from real ids', () => {
    for (const preset of EQUIPMENT_PRESETS) {
      expect(preset.equipment.length).toBeGreaterThan(0);
      for (const item of preset.equipment) expect(EQUIPMENT_IDS).toContain(item);
    }
  });

  it('ships a default set that can actually train something', () => {
    const trainable = TRAINABLE_FOCUSES.filter((f) => focusIsPossible(f, DEFAULT_EQUIPMENT));
    expect(trainable.length).toBeGreaterThan(2);
  });

  it('lets every preset train at least one climbing focus', () => {
    for (const preset of EQUIPMENT_PRESETS) {
      const possible = TRAINABLE_FOCUSES.filter((f) => focusIsPossible(f, preset.equipment));
      expect({ preset: preset.id, some: possible.length > 0 }).toEqual({
        preset: preset.id,
        some: true,
      });
    }
  });
});

describe('focusIsPossible', () => {
  it('is satisfied by any single listed item, not all of them', () => {
    expect(focusIsPossible('maxStrength', ['hangboard'])).toBe(true);
    expect(focusIsPossible('maxStrength', ['boulder-wall'])).toBe(true);
  });

  it('is false when nothing required is on hand', () => {
    expect(focusIsPossible('power', ['bands'])).toBe(false);
  });

  it('is always true for focuses that need nothing', () => {
    expect(focusIsPossible('conditioning', [])).toBe(true);
    expect(focusIsPossible('enduranceAerobic', [])).toBe(true);
  });

  it('names what is missing in the climber’s words', () => {
    const label = missingEquipmentLabel('power');
    expect(label).toContain('Campus board');
    expect(label).toContain(' or ');
  });
});

describe('orderByHierarchy', () => {
  it('puts a shuffled session back into the correct within-session order', () => {
    expect(orderByHierarchy(['conditioning', 'maxStrength', 'skill'])).toEqual([
      'skill',
      'maxStrength',
      'conditioning',
    ]);
  });

  it('places aerobic stamina last, after conditioning', () => {
    const ordered = orderByHierarchy(['enduranceAerobic', 'conditioning', 'skill']);
    expect(ordered[ordered.length - 1]).toBe('enduranceAerobic');
  });

  it('does not mutate its input', () => {
    const input = ['conditioning', 'skill'] as const;
    const copy = [...input];
    orderByHierarchy([...input]);
    expect([...input]).toEqual(copy);
  });
});

describe('the exercise library', () => {
  it('has unique ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tags every exercise with real equipment ids', () => {
    for (const exercise of EXERCISES) {
      for (const item of exercise.equipment) {
        expect({ id: exercise.id, item, known: EQUIPMENT_IDS.includes(item) }).toEqual({
          id: exercise.id,
          item,
          known: true,
        });
      }
    }
  });

  it('covers every focus that draws from the library', () => {
    // If a focus's area had no exercise the plan would silently drop that step
    // and the climber would get a shorter session than prescribed. `skill` and
    // `mental` are exempt: they're trained with drills from `prescriptions`,
    // not with sets and reps, so the library has nothing under `skill`.
    const drillBased = new Set(['skill', 'mental', 'rest']);
    for (const focus of SESSION_FOCUSES) {
      if (drillBased.has(focus.id)) continue;
      const pool = EXERCISES.filter((e) => e.hierarchyAreaId === focus.hierarchyAreaId);
      expect({ focus: focus.id, hasExercises: pool.length > 0 }).toEqual({
        focus: focus.id,
        hasExercises: true,
      });
    }
  });

  it('has drills for the two focuses the library deliberately does not cover', () => {
    expect(PRESCRIPTIONS_BY_AREA.mental.length).toBeGreaterThan(0);
    expect(PRESCRIPTIONS_BY_AREA.technical.length).toBeGreaterThan(0);
  });

  it('offers something for a climber with no equipment at all', () => {
    const bodyweight = EXERCISES.filter((e) => e.equipment.length === 0);
    expect(bodyweight.length).toBeGreaterThan(5);
  });
});
