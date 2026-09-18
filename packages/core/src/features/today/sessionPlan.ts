/**
 * Turn a session focus into ordered, do-this-now steps.
 *
 * The scheduler decides *what* (max strength, skill, rest). This decides *how*,
 * in Hörst's numbers: grip, hold size, sets, work/rest, and — where we have a
 * measured baseline — the load. Lifting stays "use what you last logged";
 * everything else is a protocol, not a vibe.
 *
 * Source (maintainers only): Eric J. Hörst, *Training for Climbing* (3rd ed.)
 * — within-session order (Ch 5, 10), fingerboard Tables 8.2–8.7, HIT 8.5/8.9,
 * campus (Ch 8–9), 4x4s and ARC (Ch 8), antagonists (Ch 6), core (Ch 7).
 */
import { PRESCRIPTIONS_BY_AREA } from '../../content/prescriptions';
import { protocolForExercise, TRACKABLE_PROTOCOLS } from '../../content/protocols';
import type { AbilityTier } from '../../content/planning';
import {
  sessionFocus,
  type EquipmentId,
  type SessionFocusId,
  type SessionLength,
} from '../../content/trainingContext';
import type { Exercise } from '../../content/types';
import { EXERCISES } from '../../content/exercises';
import type { BenchmarkRecord } from '../../db/types';
import { isDoableWith } from '../train/exercises';
import { prescribeProtocol, type ProtocolPrescription } from '../train/prescribe';
import type { DetectedInjury } from '../train/injury';
import { formatBands, type ClimbingPrescription } from './climbingPrescription';

/**
 * One line of the plan, with the provenance the UI needs.
 *
 * `plan` (plain strings) stays the display/AI surface; this parallel array
 * carries the exercise and protocol ids so a step like "max-weight hangs" can
 * show last session's weight inline instead of being an opaque sentence.
 */
export interface PlanStep {
  text: string;
  focus?: SessionFocusId;
  exerciseId?: string;
  /** Set when this step has a number worth recording (see content/protocols). */
  protocolId?: string;
  /**
   * Today's numbers for that protocol, when the app is willing to prescribe
   * them. Absent for `track` protocols, where choosing the load is the
   * climber's call.
   */
  prescription?: ProtocolPrescription;
}

export interface SessionPlanContext {
  dayIdx: number;
  equipment: EquipmentId[];
  benchmarks: BenchmarkRecord[];
  nowMs: number;
  abilityTier: AbilityTier;
  sessionLength: SessionLength;
  climbing: ClimbingPrescription | null;
  injury: DetectedInjury | null;
}

function has(ctx: SessionPlanContext, id: EquipmentId): boolean {
  return ctx.equipment.includes(id);
}

function canClimb(ctx: SessionPlanContext): boolean {
  return (
    has(ctx, 'boulder-wall') ||
    has(ctx, 'rope-wall') ||
    has(ctx, 'steep-wall') ||
    has(ctx, 'system-board') ||
    has(ctx, 'outdoor-rock')
  );
}

function rotate<T>(items: T[], dayIdx: number): T {
  return items[((dayIdx % items.length) + items.length) % items.length];
}

function step(text: string, extra: Partial<PlanStep> & { focus: SessionFocusId }): PlanStep {
  return { text, ...extra };
}

function protocolStep(
  focus: SessionFocusId,
  exerciseId: string,
  ctx: SessionPlanContext,
  textFor: (p: ProtocolPrescription | null, exercise: Exercise) => string,
): PlanStep | null {
  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  if (!exercise || !isDoableWith(exercise, ctx.equipment)) return null;
  const protocolId = protocolForExercise(exercise.id)?.id;
  const prescription = protocolId ? prescribeProtocol(protocolId, ctx.benchmarks, ctx.nowMs) : null;
  return {
    text: textFor(prescription, exercise),
    focus,
    exerciseId,
    protocolId,
    ...(prescription ? { prescription } : {}),
  };
}

function grades(ctx: SessionPlanContext): string {
  if (!ctx.climbing) return '';
  const bands = formatBands(ctx.climbing.bands);
  return bands ? ` Grades today: ${bands}.` : '';
}

function styleLine(ctx: SessionPlanContext): string {
  return ctx.climbing?.style ? ` ${ctx.climbing.style}` : '';
}

export function warmUpStep(ctx: SessionPlanContext): PlanStep {
  const climbBit = canClimb(ctx)
    ? `then easy climbing${ctx.climbing?.bands.warmUp ? ` around ${ctx.climbing.bands.warmUp}` : ' 2–3 grades below your limit'} until you are through the flash pump — no projecting.`
    : has(ctx, 'hangboard') || has(ctx, 'pull-up-bar')
      ? 'then joint mobility and easy pulling on large holds until the shoulders feel warm.'
      : 'then joint mobility and easy bodyweight movement until you feel warm.';
  return {
    text: `Warm up (20–30 min): 5 min pulse-raiser (jumping jacks, easy bike, or jog), 20 arm circles, 40 finger curls, light forearm massage, ${climbBit} Shoulders engaged, chest out, no shrugged hangs.`,
  };
}

export function coolDownStep(): PlanStep {
  return {
    text: 'Cool down (5–10 min): easy movement, then stretch finger flexors (10s + 20s each arm, both palm-down and palm-up), posterior shoulder, and hip flexors. Foam-roll upper back and forearms if you have a roller. Eat a real meal within 1–2 hours; sleep 7–8 hours.',
  };
}

export function restSteps(injury: DetectedInjury | null): PlanStep[] {
  if (injury) {
    return [
      {
        text: `Rest from climbing and hard training. ${injury.summary} You wrote: "${injury.evidence}"`,
      },
      {
        text: injury.noClimbing
          ? 'Do not test it today. No hangboard, campus, limit boulders, or performance routes. Walking is fine if it does not aggravate the injury; skip anything that loads the injured area.'
          : 'Keep the injured area unloaded. Easy mobility and antagonist work that does not load it is fine; nothing near your limit.',
      },
      {
        text: 'Recovery work: 10 min gentle mobility for uninjured areas, hydrate, eat well, 7–8 hours of sleep. Book or keep the medical follow-up (MRI, physio) rather than climbing through it.',
      },
    ];
  }
  return [
    { text: 'Rest from hard climbing and training today.' },
    {
      text: 'Stay loose: 20–30 min easy walk, then 10 min mobility (foam roll upper back and glutes, finger-flexor stretch, hip-flexor stretch). No hangboard, no limit boulders.',
    },
    {
      text: 'Prioritise sleep (7–8 hours), a real meal within a couple of hours of waking, and hydration — recovery is when the gains happen.',
    },
  ];
}

function skillSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const drill = rotate(PRESCRIPTIONS_BY_AREA.technical, ctx.dayIdx);
  const volume = ctx.climbing?.bands.volume
    ? `Stay at or below ${ctx.climbing.bands.volume}`
    : 'Stay 1–2 grades below your limit';
  const count = role === 'primary' ? '8–12 problems or 4–6 routes' : '4–6 problems or 2–3 routes';
  const duration = role === 'primary' ? '30–45 min' : '15–20 min';
  return [
    step(
      `Skill & movement — ${drill.title}: ${drill.detail} Do this for ${duration} on terrain you can reverse. ${volume}; if you start fighting, the grade is too high.`,
      { focus: 'skill' },
    ),
    ...(role === 'primary' && canClimb(ctx)
      ? [
          step(
            `Skill mileage: ${count}, each done as a rehearsal not a send. Read the sequence on the ground, climb briskly between rests, downclimb the ones you send. Silent feet on every placement.${grades(ctx)}`,
            { focus: 'skill' },
          ),
        ]
      : []),
  ];
}

function mentalSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const drill = rotate(PRESCRIPTIONS_BY_AREA.mental, ctx.dayIdx);
  const extra =
    drill.title === 'Tactical breathing'
      ? ' Protocol: before leaving the ground, 5 belly breaths of ~10 s each (nose in, mouth out). Repeat 3 breaths at every rest and before the crux.'
      : drill.title === 'Practice falls'
        ? ' Only on a safe overhanging toprope or well-bolted sport climb with a competent belayer. Start with a small planned fall, then one a bit bigger. Stop if anything feels structurally wrong.'
        : drill.title === 'Pre-climb visualization'
          ? ' 2 minutes, eyes closed, associated (from behind your own eyes) then once disassociated (watching yourself send). Include the successful clip/top-out.'
          : ' Pick one word before you pull on ("smooth", "breathe", "feet") and return to it every time the critic starts talking.';
  const onWall = canClimb(ctx)
    ? ` Then climb ${role === 'primary' ? '3–5' : '2–3'} routes/problems at your work grade applying that skill under real pressure.${grades(ctx)}`
    : '';
  return [
    step(`Mental game — ${drill.title}: ${drill.detail}${extra}${onWall}`, { focus: 'mental' }),
  ];
}

function maxStrengthSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const out: PlanStep[] = [];
  const hangVariant = ctx.dayIdx % 3;

  if (has(ctx, 'hangboard') && ctx.abilityTier !== 'beginner') {
    if (hangVariant === 1) {
      const minEdge = protocolStep('maxStrength', 'fingerboard-pyramids', ctx, (p) => {
        // Min-edge uses the same exercise id as pyramids/max-weight in the library
        // but is a different protocol — spell it in Hörst's numbers, no invented load.
        void p;
        return 'Max strength — Minimum-edge hangs (Table 8.2): half-crimp, no thumb lock. Pick an edge you can barely hold 15 s. 5 hangs × 12 s · 3 min rest between hangs · 2–3 sets · 5 min between sets. End every hang at 12 s. Little to no pump. Shoulders engaged, chest out, no shrug.';
      });
      if (minEdge) {
        minEdge.protocolId = undefined;
        minEdge.prescription = undefined;
        out.push(minEdge);
      }
    } else if (hangVariant === 2) {
      const seven = protocolStep('maxStrength', 'fingerboard-pyramids', ctx, (p) => {
        const load = p?.kind === 'work' && p.targetLabel ? `${p.targetLabel} ` : '';
        const core =
          p?.kind === 'work'
            ? `7 s hang / 53 s rest · 3 hangs per set · 2–3 sets · 5 min between sets, ${load}on a 14–20 mm edge, half-crimp or open-hand. End every hang at 7 s; the load should make you fail around 10 s if you kept going.`
            : (p?.text ??
              'Max-weight 7-53: establish added weight on a 14–20 mm edge so a hang fails around 10 s, then 7 s hang / 53 s rest · 3 hangs · 2–3 sets · 5 min between sets.');
        return `Max strength — Max-weight 7-53 (Table 8.4): ${core} Do not also do 10-second hangs today.`;
      });
      if (seven) out.push(seven);
    } else {
      const ten = protocolStep('maxStrength', 'fingerboard-pyramids', ctx, (p) => {
        if (p?.kind === 'work' && p.targetLabel) {
          return `Max strength — Max-weight hangs (Table 8.3): ${p.targetLabel} on a 14–20 mm edge, half-crimp or open-hand (no thumb lock). 5 hangs × 10 s · 3 min rest between hangs · 2–3 sets · 5 min between sets. End every hang at 10 s; you should fail around 13 s if you kept going. Shoulders engaged, chest out.`;
        }
        return `Max strength — ${p?.text ?? 'Max-weight hangs — establish your baseline on a 14–20 mm edge, half-crimp, 10 s hangs with 3 min rest, adding weight until a hang gets hard but stays clean.'}`;
      });
      if (ten) out.push(ten);
    }
  }

  if (canClimb(ctx) && role === 'primary') {
    const boulder = has(ctx, 'boulder-wall') || has(ctx, 'steep-wall') || has(ctx, 'system-board');
    if (boulder) {
      const work = ctx.climbing?.bands.work
        ? ` around ${ctx.climbing.bands.work}`
        : ' near your limit';
      out.push(
        step(
          `Max strength — Limit boulders: 4–6 problems${work}, each climbable in under 15 s (ATP-CP, not a pump). 3 attempts per problem with 2–3 min rest. Isolate one grip per problem when you can (half-crimp, open-hand, pinch, 2-finger teams). Step off rather than fight into the lactic system.${styleLine(ctx)}`,
          { focus: 'maxStrength', exerciseId: 'bouldering' },
        ),
      );
    } else if (has(ctx, 'outdoor-rock') || has(ctx, 'rope-wall')) {
      out.push(
        step(
          `Max strength — Short, powerful climbing: 4–6 boulder-length efforts or cruxes, under 15 s, full rest (2–3 min) between. No pump-chasing.${grades(ctx)}`,
          { focus: 'maxStrength' },
        ),
      );
    }
  }

  if (has(ctx, 'pull-up-bar') && role === 'primary' && ctx.abilityTier !== 'beginner') {
    const weighted = protocolStep('maxStrength', 'hypergravity-pull-ups', ctx, () => {
      return 'Max strength — Weighted pull-ups: 3–5 sets of 5 reps with enough added weight that 5 is hard (not a max-rep set). Explode up, 2 s lower, stop just short of a straight-arm shrug. 3 min rest between sets. Use last session’s added weight; do not guess a new max.';
    });
    if (weighted) out.push(weighted);
  }

  if (out.length === 0) {
    out.push(
      step(
        'Max strength — Hard, short efforts on whatever you have: 5–8 near-limit reps or hangs that fail in under 12 s, 3 min rest, 3–5 sets. If it lasts longer than 12 s you are training endurance, not strength.',
        { focus: 'maxStrength' },
      ),
    );
  }
  return role === 'supporting' ? out.slice(0, 1) : out;
}

function powerSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const out: PlanStep[] = [];
  if (has(ctx, 'campus-board') && ctx.abilityTier !== 'beginner') {
    out.push(
      step(
        'Power — Campus laddering (large rungs): 1-3-5-7 from matched hands on rung 1, no feet, open-hand grip, slight elbow bend, chest out, never a straight-arm shrugged catch. 4–8 sets, each a 3–6 s sprint. 3 min rest. Quality over volume — stop at the first ugly catch.',
        { focus: 'power', exerciseId: 'campus-laddering', protocolId: 'protocol-campus-rung' },
      ),
    );
    if (role === 'primary') {
      out.push(
        step(
          'Power — Campus bumps or switch-hands on medium rungs, 2–4 sets of ≤10 s, 2 min rest. Same shoulder rules. Skip double dynos unless you already climb ~5.13/V8 and nothing hurts.',
          { focus: 'power', exerciseId: 'campus-double-dynos', protocolId: 'protocol-campus-rung' },
        ),
      );
    }
  } else if (canClimb(ctx)) {
    out.push(
      step(
        `Power — Big-move boulders: 3 problems of 6–10 moves on medium-to-large holds (grip should not be the limiter), long reaches and the odd lunge. 3–5 sends each, 3 min rest. Climb faster and more accurately each lap.${styleLine(ctx)}`,
        { focus: 'power', exerciseId: 'big-move-boulder-problems' },
      ),
    );
    if (role === 'primary') {
      out.push(
        step(
          'Power — One-arm lunges, feet on: 2–3 sets per hand of 6–12 hand movements in ≤10 s on two large holds ~12–18 inches apart. Absorb and recoil; rotator cuff on, chest out.',
          { focus: 'power', exerciseId: 'one-arm-lunging' },
        ),
      );
    }
  } else if (has(ctx, 'pull-up-bar')) {
    out.push(
      step(
        'Power — Clap pull-ups or release-and-regrab pull-ups: 2–3 sets of 3–8 reps, 3 min rest. Accelerate into the bar; skip if shoulders feel unstable.',
        { focus: 'power', exerciseId: 'power-pull-ups' },
      ),
    );
  }
  if (out.length === 0) {
    out.push(
      step(
        'Power — Explosive pulling: 4–6 sets of 1–10 s max-intent moves (lunges, clap pull-ups, or dynos) with 3 min rest. Stop while the moves are still snappy.',
        { focus: 'power' },
      ),
    );
  }
  return role === 'supporting' ? out.slice(0, 1) : out;
}

function powerEnduranceSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const out: PlanStep[] = [];
  if (canClimb(ctx)) {
    const gradeHint = ctx.climbing?.bands.volume
      ? ` Pick problems ~${ctx.climbing.bands.volume} to a bit under your limit`
      : ' Pick problems a few grades below your max';
    out.push(
      step(
        `Power endurance — Bouldering 4×4: 4 problems, 4 laps each.${gradeHint} so you finish (fail only on the 4th pass if at all). 1 min per lap (climb + leftover rest), then 4 min rest after every 4th climb. ~30 min total. Use a timer.${styleLine(ctx)}`,
        { focus: 'powerEndurance', exerciseId: 'interval-climbing' },
      ),
    );
  }
  if (has(ctx, 'hangboard') && (role === 'primary' || !canClimb(ctx))) {
    const repeater = protocolStep('powerEndurance', 'fingerboard-repeaters', ctx, (p) => {
      if (p?.kind === 'work' && p.targetLabel) {
        const level = p.target ?? 1;
        const rests: Record<number, string> = {
          1: '10 s on / 30 s off',
          2: '10 s on / 20 s off',
          3: '10 s on / 10 s off',
          4: '10 s on / 5 s off',
        };
        const rest = rests[level] ?? '10 s on / 30 s off';
        return `Power endurance — Repeaters ${p.targetLabel} (${rest}): 6 hangs per set · 4 sets · 1 min between sets. Alternate half-crimp and open-hand each set. Shoulders engaged. When 5 sets at L4 feel easy, add ~10 lb or go smaller.`;
      }
      return `Power endurance — ${p?.text ?? 'Repeaters — start at L1 (10 s on / 30 s off), 6 hangs, 3–5 sets, 1 min between sets. Alternate half-crimp / open-hand.'}`;
    });
    if (repeater) out.push(repeater);
  }
  if (has(ctx, 'pull-up-bar') && role === 'primary') {
    out.push(
      step(
        'Power endurance — Frenchies: pull-up + 4 s lock-off at the top, at 90°, and at 120°. That trio is one cycle (~15 s). Do 2–6 cycles per set (30–90 s), 2–4 sets, 5 min rest. Add a 10–20 lb belt only once 5–6 cycles are clean.',
        { focus: 'powerEndurance', exerciseId: 'frenchies' },
      ),
    );
  }
  if (out.length === 0) {
    out.push(
      step(
        'Power endurance — 8–12 hard efforts of 30–90 s with 1–3 min rest (4x4s, route intervals, or Frenchies). Stop the session if the pump becomes a deep burn you cannot complete sets through — that is overdoing the least trainable system.',
        { focus: 'powerEndurance' },
      ),
    );
  }
  return role === 'supporting' ? out.slice(0, 1) : out;
}

function aerobicSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const out: PlanStep[] = [];
  if (canClimb(ctx)) {
    const minutes = role === 'primary' ? '20–30' : '10–15';
    const arc = protocolStep('enduranceAerobic', 'arc-traverses', ctx, (p) => {
      return `Aerobic endurance — ARC / recovery climbing: ${minutes} min continuous easy traversing or laps at RPE 4–6 (conversation pace, light pump at most). Step off at the first sign of a flaming pump — that would be anaerobic work, not this. ${p?.text ?? ''}`.trim();
    });
    if (arc) out.push(arc);
    if (role === 'primary') {
      out.push(
        step(
          'Aerobic endurance — Optional threshold finisher: 3–5 min intervals at RPE 7–8.5 with equal rest, 3–6 reps. Stay just at the pump line, never in a fight. Skip this if the ARC already drifted anaerobic.',
          { focus: 'enduranceAerobic' },
        ),
      );
    }
  } else if (has(ctx, 'hangboard')) {
    const moving = protocolStep('enduranceAerobic', 'fingerboard-moving-hangs', ctx, (p) => {
      const time = p?.kind === 'work' && p.targetLabel ? p.targetLabel : '3–6 min';
      return `Aerobic endurance — Moving hangs, feet on a chair: circulate around the board ${time} at RPE 5–8, shake out on jugs when the pump rises. 3–6 sets, work:rest 2:1 to 1:1. Moderate pump only.`;
    });
    if (moving) out.push(moving);
  } else {
    out.push(
      step(
        'Aerobic endurance — 20–30 min tempo run or row at RPE ~8 / ~85% max HR (talk in short sentences). This is recovery-power work, not a long slow jog and not a sprint session.',
        { focus: 'enduranceAerobic', exerciseId: 'aerobic-base' },
      ),
    );
  }
  return out;
}

function conditioningSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const out: PlanStep[] = [];
  const sets = role === 'primary' ? '2–3 sets' : '2 sets';

  out.push(
    step(
      `Antagonist & core — Wrist extensors: reverse wrist curls ${sets} of 15–20 (light, stop 2 reps before failure), then a 45–60 s isometric wrist extension hold × 2. Wide pinch with wrist extended 3 × 10–30 s per hand if you have a block or bumper plate.`,
      { focus: 'conditioning', exerciseId: 'reverse-wrist-curls' },
    ),
  );
  const scapular = has(ctx, 'pull-up-bar')
    ? 'scapular T 2 × 10–15, scapular Y 2 × 10–15, scapular pull-ups 1–2 × 8–12'
    : 'scapular T 2 × 10–15 and scapular Y 2 × 10–15 (prone or band). If you have a bar later in the week, add scapular retractions there';
  out.push(
    step(
      `Antagonist & core — Shoulders: dumbbell external rotation 2 × 20–25 per side (about half the internal-rotation load), ${scapular}. Moderate load, never a grind.`,
      { focus: 'conditioning', exerciseId: 'scapular-t-y' },
    ),
  );

  if (role === 'primary') {
    const core = rotate(
      [
        'Hanging knee lifts 2 × 10–15 (scapulars on, no swing).',
        'Windshield wipers 2–3 × 6–12 (bend the bar, 9 o’clock to 3 o’clock).',
        'Front lever attempts 2 × 2–5 holds of 2 s (spot or tuck if needed); skip if shoulders or elbows complain.',
        'Side hip raises 2 × 10–20 per side, then a 20–60 s reverse plank.',
      ],
      ctx.dayIdx,
    );
    out.push(step(`Antagonist & core — ${core}`, { focus: 'conditioning' }));

    if (has(ctx, 'free-weights')) {
      // Lifting: name the session, do not invent a working weight.
      const lift = rotate(['deadlift', 'sumo-deadlift', 'barbell-squat'] as const, ctx.dayIdx);
      const lifting: Record<typeof lift, string> = {
        deadlift:
          'Deadlift — warm-up set of 6, then 5 / 4 / 3, adding a little each set. 3–5 min rest. Use last session’s working weight; do not jump to a new max. Belt on near a hard set. Stop if the back rounds.',
        'sumo-deadlift':
          'Sumo deadlift with a dumbbell or kettlebell: 2 × 15, moderate load, last-logged weight. Straight back, hips through, no shrug at the top.',
        'barbell-squat':
          'Squat: 2 × 5–8 at last-logged working weight (never more than 8). Sit back, knees track toes, belt optional. Skip if the back or knees are the thing that hurts.',
      };
      const exerciseId = lift === 'deadlift' ? 'deadlift' : lift;
      out.push(
        step(`Antagonist & core — ${lifting[lift]}`, {
          focus: 'conditioning',
          exerciseId,
          protocolId:
            lift === 'barbell-squat'
              ? 'protocol-squat'
              : lift === 'deadlift'
                ? 'protocol-deadlift'
                : 'protocol-deadlift',
        }),
      );
    } else {
      out.push(
        step(
          'Antagonist & core — Push: 2 × 15–20 push-ups (knees if needed) and 2 × 8–20 dips if you have bars/rings, stopping at 90° elbow. This is muscle balance, not a chest day.',
          { focus: 'conditioning', exerciseId: 'push-ups-bench' },
        ),
      );
    }
  }
  return out;
}

/**
 * Concrete steps for one focus. `primary` gets the full protocol; `supporting`
 * gets a shorter but still specific block so a long day does not become a book.
 */
export function buildFocusSteps(
  focus: SessionFocusId,
  ctx: SessionPlanContext,
  role: 'primary' | 'supporting',
): PlanStep[] {
  switch (focus) {
    case 'skill':
      return skillSteps(ctx, role);
    case 'mental':
      return mentalSteps(ctx, role);
    case 'maxStrength':
      return maxStrengthSteps(ctx, role);
    case 'power':
      return powerSteps(ctx, role);
    case 'powerEndurance':
      return powerEnduranceSteps(ctx, role);
    case 'enduranceAerobic':
      return aerobicSteps(ctx, role);
    case 'conditioning':
      return conditioningSteps(ctx, role);
    case 'rest':
      return restSteps(ctx.injury);
  }
}

/** Ordered session: warm-up → primary → supporting → cool-down. */
export function buildSessionSteps(
  primary: SessionFocusId | null,
  supporting: SessionFocusId[],
  ctx: SessionPlanContext,
): PlanStep[] {
  if (!primary || primary === 'rest') return restSteps(ctx.injury);
  const steps: PlanStep[] = [warmUpStep(ctx)];
  steps.push(...buildFocusSteps(primary, ctx, 'primary'));
  for (const focus of supporting) {
    if (!focus || focus === 'rest') continue;
    steps.push(...buildFocusSteps(focus, ctx, 'supporting'));
  }
  steps.push(coolDownStep());
  return steps.filter((s) => s.text.trim().length > 0);
}

/** So callers can still label a focus without importing the catalog. */
export function focusLabel(id: SessionFocusId): string {
  return sessionFocus(id).label;
}

function normalizePlanText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[×]/g, 'x')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function overlayMatchScore(aiText: string, step: PlanStep): number {
  const a = normalizePlanText(aiText);
  const b = normalizePlanText(step.text);
  if (a === b) return 100;
  let score = 0;
  if (step.protocolId) {
    const protocol = TRACKABLE_PROTOCOLS.find((p) => p.id === step.protocolId);
    if (protocol && a.includes(normalizePlanText(protocol.name))) score += 8;
  }
  const hints = [
    /min(?:imum)?\s*edge/,
    /\b7\s*53\b/,
    /max[\s-]*weight hang/,
    /repeater/,
    /frenchie/,
    /4\s*x\s*4/,
    /\barc\b/,
    /campus/,
    /deadlift/,
    /moving hang/,
    /weighted pull/,
  ];
  for (const re of hints) {
    if (re.test(a) && re.test(b)) score += 6;
  }
  return score;
}

/**
 * Keep the AI's wording, re-attach protocol/exercise ids from the built-in
 * steps so inline number loggers still work after a rewrite.
 */
export function overlayAiPlan(baseline: PlanStep[], aiPlan?: string[] | null): PlanStep[] {
  if (!aiPlan?.length) return baseline;
  const taken = new Set<number>();
  return aiPlan.map((text) => {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < baseline.length; i++) {
      if (taken.has(i)) continue;
      const score = overlayMatchScore(text, baseline[i]);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0 || bestScore < 4) return { text };
    taken.add(best);
    return { ...baseline[best], text };
  });
}
