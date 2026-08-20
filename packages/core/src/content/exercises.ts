/**
 * Exercise library — Eric J. Hörst, *Training for Climbing* (3rd ed., 2016).
 * Draws on the four physical-training chapters:
 *   • Ch 6 — Mobility, Stability, Antagonist training
 *   • Ch 7 — Core, Legs, and Aerobic training
 *   • Ch 8 — Finger training (strength & endurance)
 *   • Ch 9 — Pull-muscle and power training
 * Names follow the book; the brief descriptions are paraphrased.
 */
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  // --- Mobility & self-myofascial release (Ch 6) ---
  {
    id: 'foam-rolling',
    name: 'Foam rolling (self-myofascial release)',
    category: 'mobility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description:
      'Roll the upper back, glutes, hip flexors, and IT band, pausing 15–30 s on trigger points to release tight fascia. A daily habit that aids recovery and mobility.',
  },
  {
    id: 'forearm-self-massage',
    name: 'Forearm & elbow self-massage',
    category: 'mobility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description:
      'Pin-and-stretch the forearm flexors, extensors, and pronators (by hand or with an Armaid/Rubbit) to head off elbow tendinosis. Never press directly on a tendon or the epicondyle.',
  },

  // --- Stability: rotator cuff & scapula (Ch 6) ---
  {
    id: 'rotator-cuff-rotations',
    name: 'Rotator-cuff internal & external rotation',
    category: 'stability',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights', 'bands'],
    description:
      'Light dumbbell internal and external rotations (20–25 reps, 2 sets each) to balance and protect the shoulder. External load is roughly half the internal load.',
  },
  {
    id: 'scapular-t-y',
    name: 'Scapular “T” and “Y” raises',
    category: 'stability',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights', 'bands', 'rings-trx'],
    description:
      'Prone or TRX raises that retract (T) and depress/upward-rotate (Y) the scapula, training the mid and lower trapezius and rhomboids for a stable pulling base.',
  },
  {
    id: 'scapular-pushups-pullups',
    name: 'Scapular push-ups & pull-ups',
    category: 'stability',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['pull-up-bar', 'rings-trx'],
    description:
      'Protraction (scapular push-up, serratus anterior) and depression/retraction (scapular pull-up) drills that build shoulder-girdle control for hard pulling.',
  },

  // --- Finger & forearm (max finger strength) ---
  {
    id: 'bouldering',
    name: 'Bouldering',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['boulder-wall', 'steep-wall', 'system-board', 'outdoor-rock'],
    description:
      'Hard, low-rep climbing on boulder problems — the most fundamental way to build finger strength and power.',
  },
  {
    id: 'hypergravity-bouldering',
    name: 'Hypergravity bouldering',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['boulder-wall', 'steep-wall', 'system-board'],
    description: 'Bouldering with added weight (weight vest/belt) to overload finger strength.',
  },
  {
    id: 'fingerboard-repeaters',
    name: 'Fingerboard repeaters',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['hangboard'],
    description:
      'Repeated ~7s hangs with short rests on fixed edges to build finger strength and endurance.',
  },
  {
    id: 'fingerboard-pyramids',
    name: 'Fingerboard pyramids',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['hangboard'],
    description: 'Hangs that progress through grip types/edge sizes in a pyramid of intensity.',
  },
  {
    id: 'hit',
    name: 'Hypergravity Isolation Training (HIT)',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['steep-wall', 'system-board'],
    description:
      'Climb identical HIT-strip holds with added weight to isolate and overload each grip position.',
  },
  {
    id: 'one-arm-lunging',
    name: 'One-arm lunging',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['boulder-wall', 'steep-wall', 'system-board'],
    description: 'Explosive one-arm moves on a wall to build contact strength and power.',
  },

  // --- Pull muscles (max strength) ---
  {
    id: 'pull-ups',
    name: 'Pull-ups & lat pull-downs',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Foundational pulling strength for the back and arms.',
  },
  {
    id: 'hypergravity-pull-ups',
    name: 'Hypergravity pull-ups',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Weighted pull-ups to overload maximum pulling strength.',
  },
  {
    id: 'uneven-grip-pull-ups',
    name: 'Uneven-grip pull-ups',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'One hand high on the bar, one low (or on a sling) to bias load toward one arm.',
  },
  {
    id: 'one-arm-lock-offs',
    name: 'One-arm lock-offs',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Hold a static bent-arm position on one arm to build lock-off strength.',
  },
  {
    id: 'steep-wall-lock-off',
    name: 'Steep-wall lock-off',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['steep-wall', 'boulder-wall', 'system-board'],
    description:
      'Lock off on steep holds to train pulling strength in a climbing-specific position.',
  },

  // --- Power ---
  {
    id: 'campus-laddering',
    name: 'Campus laddering',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['campus-board'],
    description:
      'Explosive up-and-down moves on campus rungs with no feet to build reactive power.',
  },
  {
    id: 'campus-lock-offs',
    name: 'Campus lock-offs',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['campus-board'],
    description: 'Campus-board lock-offs for static power and body tension.',
  },
  {
    id: 'campus-double-dynos',
    name: 'Campus double dynos',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['campus-board'],
    description: 'Both hands leaving and catching rungs to develop maximal explosive power.',
  },
  {
    id: 'power-pull-ups',
    name: 'Power pull-ups',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Fast, explosive pull-ups (chest-to-bar) to train upper-body power.',
  },
  {
    id: 'big-move-boulder-problems',
    name: 'Big-move boulder problems',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    equipment: ['boulder-wall', 'steep-wall', 'system-board', 'outdoor-rock'],
    description: 'Boulder problems featuring large dynamic moves to train power on the rock.',
  },

  // --- Endurance (anaerobic) ---
  {
    id: 'traverse-training',
    name: 'Traverse training',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    equipment: ['boulder-wall', 'steep-wall', 'system-board'],
    description: 'Continuous traversing to build forearm (anaerobic) endurance and footwork.',
  },
  {
    id: 'fingerboard-moving-hangs',
    name: 'Fingerboard moving hangs',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    equipment: ['hangboard'],
    description: 'Moving between holds while hanging to extend time-under-tension for endurance.',
  },
  {
    id: 'interval-climbing',
    name: 'Interval climbing',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    equipment: ['rope-wall', 'boulder-wall', 'steep-wall', 'system-board'],
    description: 'Laps on routes/problems with timed rests to train power endurance.',
  },
  {
    id: 'tabata',
    name: 'Tabata protocol',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    equipment: ['boulder-wall', 'steep-wall', 'system-board'],
    description:
      '20s max-effort / 10s rest intervals (up to 8 rounds) — a grueling endurance stimulus.',
  },
  {
    id: 'frenchies',
    name: 'Frenchies',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    equipment: ['pull-up-bar', 'rings-trx'],
    description:
      'Pull-ups interspersed with timed lock-offs at three positions to build strength-endurance.',
  },
  {
    id: 'pull-up-intervals',
    name: 'Pull-up intervals',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Sets of pull-ups with short rests to build pulling endurance.',
  },

  // --- Core ---
  {
    id: 'abdominal-crunch',
    name: 'Abdominal crunch',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Controlled crunches for the abdominals.',
  },
  {
    id: 'hanging-knee-lift',
    name: 'Hanging knee lift',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Hang from a bar and raise the knees to train the lower abs and hip flexors.',
  },
  {
    id: 'side-hip-raise',
    name: 'Side hip raise',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Side-plank hip raises for the obliques and lateral core.',
  },
  {
    id: 'aquaman',
    name: 'Aquaman',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Prone opposite arm/leg raises for the lower back and posterior chain.',
  },
  {
    id: 'front-lever',
    name: 'Front lever',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['pull-up-bar', 'rings-trx'],
    description: 'Advanced straight-body hang for powerful full-body tension.',
  },
  {
    id: 'one-arm-one-leg-bridge',
    name: 'One-arm, one-leg bridge',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Anti-rotation bridge for deep core stability.',
  },

  // --- Antagonist ---
  {
    id: 'reverse-wrist-curls',
    name: 'Reverse wrist curls',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights', 'bands'],
    description:
      'Strengthen the forearm extensors to balance the flexors and help prevent elbow pain.',
  },
  {
    id: 'pronators',
    name: 'Forearm pronators',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights', 'bands'],
    description: 'Forearm rotation work to balance the forearm and protect the elbow.',
  },
  {
    id: 'shoulder-press',
    name: 'Shoulder press',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights'],
    description: 'Overhead pressing for shoulder balance and health.',
  },
  {
    id: 'push-ups-bench',
    name: 'Push-ups / bench press',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Pushing strength to balance the dominant pulling muscles.',
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Triceps and chest pressing to round out antagonist conditioning.',
  },

  // --- Legs & posterior chain (Ch 7) ---
  {
    id: 'deadlift',
    name: 'Barbell deadlift',
    category: 'legs',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights'],
    description:
      'Low-rep, heavy posterior-chain strength (warm-up set of 6, then 5/4/3) trained for neural strength without bulk. Twice a week at most; wear a belt near your max.',
  },
  {
    id: 'sumo-deadlift',
    name: 'Sumo deadlift',
    category: 'legs',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights'],
    description:
      'Wide-stance dumbbell/kettlebell deadlift (2 × 15) for hips, glutes, and hamstrings — a climbing-friendly way to load the posterior chain.',
  },
  {
    id: 'barbell-squat',
    name: 'Barbell squat',
    category: 'legs',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights'],
    description:
      'Low-rep squats (2 × 5–8, never more) for leg drive on high steps and slabs. Start light and build toward body weight over a year or two; avoid hypertrophy.',
  },
  {
    id: 'dumbbell-snatch',
    name: 'One-arm dumbbell snatch',
    category: 'legs',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: ['free-weights'],
    description:
      'Explosive full-body pull from floor to overhead (5–10 reps) that trains power through the posterior chain and total-body coordination.',
  },

  // --- Aerobic (Ch 7) ---
  {
    id: 'aerobic-base',
    name: 'Steady-state aerobic training',
    category: 'aerobic',
    triadArea: 'physical',
    hierarchyAreaId: 'stamina',
    equipment: [],
    description:
      'At least 30 minutes of sustained moderate-intensity work (running preferred; also rowing, biking, swimming), several days a week, to build recovery and general stamina.',
  },
  {
    id: 'aerobic-intervals',
    name: 'Aerobic (threshold) intervals',
    category: 'aerobic',
    triadArea: 'physical',
    hierarchyAreaId: 'stamina',
    equipment: [],
    description:
      'Tempo/threshold intervals — e.g. 1 min hard / 2 min easy for ~20 min, or fast/slow track laps — to raise aerobic power that speeds pump recovery between hard efforts.',
  },
  {
    id: 'arc-traverses',
    name: 'ARC traverses',
    category: 'aerobic',
    triadArea: 'physical',
    hierarchyAreaId: 'stamina',
    equipment: ['boulder-wall', 'rope-wall', 'steep-wall', 'system-board'],
    description:
      'Long, continuous easy climbing at a low, no-pump intensity (RPE 4–6) for ~30 min to build local aerobic capacity and capillarity in the forearms.',
  },

  // --- Flexibility ---
  {
    id: 'finger-flexor-stretch',
    name: 'Finger flexor stretch & massage',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Stretch and massage the finger flexors to aid recovery and prevent tweaks.',
  },
  {
    id: 'high-step-stretch',
    name: 'Quadriceps & hip-flexor stretch',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Open the hips and hip flexors for high steps and high feet.',
  },
  {
    id: 'groin-adductor-stretch',
    name: 'Groin / adductor stretch',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Improve hip range for stemming, drop-knees, and wide stances.',
  },
  {
    id: 'shoulder-chest-stretch',
    name: 'Shoulder, chest & biceps stretch',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    equipment: [],
    description: 'Open the shoulders and chest to balance pulling-dominant posture.',
  },
];
