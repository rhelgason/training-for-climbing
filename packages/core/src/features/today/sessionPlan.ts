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
import { workoutById, workoutIsPossible, workoutSuitsTier } from '../../content/workouts';
import type { BenchmarkRecord, ExerciseLogRecord } from '../../db/types';
import { progressWorkout, type WorkoutTarget } from '../train/progression';
import type { DetectedInjury } from '../train/injury';
import { dayStartMs } from '../../lib/day';
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
  /**
   * A single number worth recording inline (content/protocols) — lifts, where
   * the load is the climber's call. Catalogued workouts use `workoutId`.
   */
  protocolId?: string;
  /** Set when the step runs a catalogued workout (content/workouts): timer and set logger. */
  workoutId?: string;
  /** Today's number for that workout, read off the logged sets. */
  target?: WorkoutTarget;
}

export interface SessionPlanContext {
  dayIdx: number;
  equipment: EquipmentId[];
  benchmarks: BenchmarkRecord[];
  /** The training notebook: every logged set, which sets today's numbers. */
  exerciseLogs?: ExerciseLogRecord[];
  nowMs: number;
  abilityTier: AbilityTier;
  sessionLength: SessionLength;
  climbing: ClimbingPrescription | null;
  injury: DetectedInjury | null;
  /**
   * Hands have been loaded three days running. The session is antagonists,
   * easy cardio, and stretching. The warm-up must not put them on the wall.
   */
  offFingers?: boolean;
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

/**
 * A step that runs a catalogued workout: today's number off the training
 * notebook first, why, then the book protocol. Null when the equipment or the
 * climber's tier rules it out.
 */
function workoutStep(
  focus: SessionFocusId,
  workoutId: string,
  ctx: SessionPlanContext,
  title: string,
  tail = '',
): PlanStep | null {
  const workout = workoutById(workoutId);
  if (!workout) return null;
  if (!workoutIsPossible(workout, ctx.equipment) || !workoutSuitsTier(workout, ctx.abilityTier)) {
    return null;
  }
  // Today's own sets don't move today's target: finishing the session would
  // otherwise rewrite the plan to tomorrow's number while it's still on screen.
  const before = dayStartMs(ctx.nowMs);
  const target = progressWorkout(workout, {
    logs: (ctx.exerciseLogs ?? []).filter((l) => l.date < before),
    benchmarks: ctx.benchmarks,
    nowMs: ctx.nowMs,
  });
  const text = [
    `${title} — ${workout.name}:`,
    target.kind === 'feel' ? '' : `${target.label}.`,
    target.because,
    workout.how,
    target.advice ?? '',
    tail.trim(),
  ]
    .filter(Boolean)
    .join(' ');
  return { text, focus, exerciseId: workout.exerciseId, workoutId, target };
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

/** Hörst: one max-hang protocol per session. Rotate them across days. */
const MAX_HANGS = ['max-hang-10', 'min-edge-hangs', 'max-hang-7-53'] as const;

function maxStrengthSteps(ctx: SessionPlanContext, role: 'primary' | 'supporting'): PlanStep[] {
  const out: PlanStep[] = [];

  const hang = workoutStep(
    'maxStrength',
    rotate([...MAX_HANGS], ctx.dayIdx),
    ctx,
    'Max strength',
    'One hang protocol today, not two.',
  );
  if (hang) out.push(hang);

  if (canClimb(ctx) && role === 'primary') {
    const boulder = has(ctx, 'boulder-wall') || has(ctx, 'steep-wall') || has(ctx, 'system-board');
    if (boulder) {
      const work = ctx.climbing?.bands.work
        ? ` Grades today: around ${ctx.climbing.bands.work}.`
        : '';
      const limit = workoutStep(
        'maxStrength',
        'limit-bouldering',
        ctx,
        'Max strength',
        `${work}${styleLine(ctx)}`,
      );
      if (limit) out.push(limit);
    } else if (has(ctx, 'outdoor-rock') || has(ctx, 'rope-wall')) {
      out.push(
        step(
          `Max strength — Short, powerful climbing: 4–6 boulder-length efforts or cruxes, under 15 s, full rest (2–3 min) between. No pump-chasing.${grades(ctx)}`,
          { focus: 'maxStrength' },
        ),
      );
    }
  }

  if (role === 'primary') {
    const weighted = workoutStep('maxStrength', 'weighted-pullups', ctx, 'Max strength');
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
  const ladder = workoutStep(
    'power',
    rotate(['campus-power-ladder', 'campus-ladder'], ctx.dayIdx),
    ctx,
    'Power',
  );
  if (ladder) {
    out.push(ladder);
    if (role === 'primary') {
      const second =
        workoutStep('power', 'campus-switch-hands', ctx, 'Power') ??
        workoutStep('power', 'campus-bumps', ctx, 'Power');
      if (second) out.push(second);
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
      ? ` Pick problems around ${ctx.climbing.bands.volume}, a bit under your limit.`
      : '';
    const fourByFour = workoutStep(
      'powerEndurance',
      'bouldering-4x4',
      ctx,
      'Power endurance',
      `${gradeHint}${styleLine(ctx)}`,
    );
    if (fourByFour) out.push(fourByFour);
  }
  if (role === 'primary' || !canClimb(ctx)) {
    const repeater = workoutStep(
      'powerEndurance',
      rotate(['repeaters-short', 'repeaters-long'], Math.floor(ctx.dayIdx / 7)),
      ctx,
      'Power endurance',
    );
    if (repeater) out.push(repeater);
  }
  if (role === 'primary') {
    const pull = workoutStep(
      'powerEndurance',
      rotate(['frenchies', 'pullup-intervals'], ctx.dayIdx),
      ctx,
      'Power endurance',
    );
    if (pull) out.push(pull);
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
    const arc = workoutStep(
      'enduranceAerobic',
      'arc',
      ctx,
      'Aerobic endurance',
      `${minutes} min today.`,
    );
    if (arc) out.push(arc);
    if (role === 'primary') {
      const threshold = workoutStep(
        'enduranceAerobic',
        'threshold-intervals',
        ctx,
        'Aerobic endurance',
        'Skip it if the ARC already drifted into a real pump.',
      );
      if (threshold) out.push(threshold);
    }
  } else if (has(ctx, 'hangboard')) {
    const moving = workoutStep('enduranceAerobic', 'moving-hangs', ctx, 'Aerobic endurance');
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

function offFingerWarmUp(): PlanStep {
  return step(
    'Warm up (10 min): easy bike, row, or jog, then arm circles and shoulder openers. Keep your hands off the wall.',
    { focus: 'conditioning' },
  );
}

function offFingerCardio(): PlanStep {
  return step(
    'Cardio — 20–30 min easy run, row, or bike at conversation pace (RPE 4–6). General aerobic work, not laps on the wall and not a sprint.',
    { focus: 'conditioning', exerciseId: 'aerobic-base' },
  );
}

function offFingerStretch(): PlanStep {
  return step(
    'Stretch (10 min): finger flexors, 10 s then 20 s each arm, palm-down and palm-up; posterior shoulder; hip flexors. Foam-roll upper back and forearms if you have a roller. Eat a real meal and sleep 7–8 hours.',
    { focus: 'conditioning' },
  );
}

/** Ordered session: warm-up → primary → supporting → cool-down. */
export function buildSessionSteps(
  primary: SessionFocusId | null,
  supporting: SessionFocusId[],
  ctx: SessionPlanContext,
): PlanStep[] {
  // Three days on the hands. Hörst still trains this day — antagonists, core,
  // a lift, easy cardio, and stretching — and does not put them back on a hold.
  if (ctx.offFingers) {
    return [
      offFingerWarmUp(),
      ...conditioningSteps(ctx, 'primary'),
      offFingerCardio(),
      offFingerStretch(),
    ];
  }
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
  if (step.workoutId) {
    const workout = workoutById(step.workoutId);
    if (workout && a.includes(normalizePlanText(workout.name))) score += 10;
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
    /limit boulder/,
    /threshold/,
    /pull up interval/,
    /hit\b/,
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
