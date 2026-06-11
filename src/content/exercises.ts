/**
 * Exercise library — Eric J. Hörst, *Training for Climbing*, Chapters 6 (general
 * conditioning) and 7 (climbing-specific exercises). Names follow the book; the
 * brief descriptions are paraphrased.
 */
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  // --- Finger & forearm (max finger strength) ---
  {
    id: 'bouldering',
    name: 'Bouldering',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description:
      'Hard, low-rep climbing on boulder problems — the most fundamental way to build finger strength and power.',
  },
  {
    id: 'hypergravity-bouldering',
    name: 'Hypergravity bouldering',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Bouldering with added weight (weight vest/belt) to overload finger strength.',
  },
  {
    id: 'fingerboard-repeaters',
    name: 'Fingerboard repeaters',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description:
      'Repeated ~7s hangs with short rests on fixed edges to build finger strength and endurance.',
  },
  {
    id: 'fingerboard-pyramids',
    name: 'Fingerboard pyramids',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Hangs that progress through grip types/edge sizes in a pyramid of intensity.',
  },
  {
    id: 'hit',
    name: 'Hypergravity Isolation Training (HIT)',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description:
      'Climb identical HIT-strip holds with added weight to isolate and overload each grip position.',
  },
  {
    id: 'one-arm-lunging',
    name: 'One-arm lunging',
    category: 'finger-forearm',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Explosive one-arm moves on a wall to build contact strength and power.',
  },

  // --- Pull muscles (max strength) ---
  {
    id: 'pull-ups',
    name: 'Pull-ups & lat pull-downs',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Foundational pulling strength for the back and arms.',
  },
  {
    id: 'hypergravity-pull-ups',
    name: 'Hypergravity pull-ups',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Weighted pull-ups to overload maximum pulling strength.',
  },
  {
    id: 'uneven-grip-pull-ups',
    name: 'Uneven-grip pull-ups',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'One hand high on the bar, one low (or on a sling) to bias load toward one arm.',
  },
  {
    id: 'one-arm-lock-offs',
    name: 'One-arm lock-offs',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Hold a static bent-arm position on one arm to build lock-off strength.',
  },
  {
    id: 'steep-wall-lock-off',
    name: 'Steep-wall lock-off',
    category: 'pull',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
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
    description:
      'Explosive up-and-down moves on campus rungs with no feet to build reactive power.',
  },
  {
    id: 'campus-lock-offs',
    name: 'Campus lock-offs',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Campus-board lock-offs for static power and body tension.',
  },
  {
    id: 'campus-double-dynos',
    name: 'Campus double dynos',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Both hands leaving and catching rungs to develop maximal explosive power.',
  },
  {
    id: 'power-pull-ups',
    name: 'Power pull-ups',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Fast, explosive pull-ups (chest-to-bar) to train upper-body power.',
  },
  {
    id: 'big-move-boulder-problems',
    name: 'Big-move boulder problems',
    category: 'power',
    triadArea: 'physical',
    hierarchyAreaId: 'maxStrengthPower',
    description: 'Boulder problems featuring large dynamic moves to train power on the rock.',
  },

  // --- Endurance (anaerobic) ---
  {
    id: 'traverse-training',
    name: 'Traverse training',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    description: 'Continuous traversing to build forearm (anaerobic) endurance and footwork.',
  },
  {
    id: 'fingerboard-moving-hangs',
    name: 'Fingerboard moving hangs',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    description: 'Moving between holds while hanging to extend time-under-tension for endurance.',
  },
  {
    id: 'interval-climbing',
    name: 'Interval climbing',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    description: 'Laps on routes/problems with timed rests to train power endurance.',
  },
  {
    id: 'tabata',
    name: 'Tabata protocol',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    description:
      '20s max-effort / 10s rest intervals (up to 8 rounds) — a grueling endurance stimulus.',
  },
  {
    id: 'frenchies',
    name: 'Frenchies',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    description:
      'Pull-ups interspersed with timed lock-offs at three positions to build strength-endurance.',
  },
  {
    id: 'pull-up-intervals',
    name: 'Pull-up intervals',
    category: 'endurance',
    triadArea: 'physical',
    hierarchyAreaId: 'anaerobicEndurance',
    description: 'Sets of pull-ups with short rests to build pulling endurance.',
  },

  // --- Core ---
  {
    id: 'abdominal-crunch',
    name: 'Abdominal crunch',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Controlled crunches for the abdominals.',
  },
  {
    id: 'hanging-knee-lift',
    name: 'Hanging knee lift',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Hang from a bar and raise the knees to train the lower abs and hip flexors.',
  },
  {
    id: 'side-hip-raise',
    name: 'Side hip raise',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Side-plank hip raises for the obliques and lateral core.',
  },
  {
    id: 'aquaman',
    name: 'Aquaman',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Prone opposite arm/leg raises for the lower back and posterior chain.',
  },
  {
    id: 'front-lever',
    name: 'Front lever',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Advanced straight-body hang for powerful full-body tension.',
  },
  {
    id: 'one-arm-one-leg-bridge',
    name: 'One-arm, one-leg bridge',
    category: 'core',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Anti-rotation bridge for deep core stability.',
  },

  // --- Antagonist ---
  {
    id: 'reverse-wrist-curls',
    name: 'Reverse wrist curls',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description:
      'Strengthen the forearm extensors to balance the flexors and help prevent elbow pain.',
  },
  {
    id: 'pronators',
    name: 'Forearm pronators',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Forearm rotation work to balance the forearm and protect the elbow.',
  },
  {
    id: 'shoulder-press',
    name: 'Shoulder press',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Overhead pressing for shoulder balance and health.',
  },
  {
    id: 'push-ups-bench',
    name: 'Push-ups / bench press',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Pushing strength to balance the dominant pulling muscles.',
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'antagonist',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Triceps and chest pressing to round out antagonist conditioning.',
  },

  // --- Flexibility ---
  {
    id: 'finger-flexor-stretch',
    name: 'Finger flexor stretch & massage',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Stretch and massage the finger flexors to aid recovery and prevent tweaks.',
  },
  {
    id: 'high-step-stretch',
    name: 'Quadriceps & hip-flexor stretch',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Open the hips and hip flexors for high steps and high feet.',
  },
  {
    id: 'groin-adductor-stretch',
    name: 'Groin / adductor stretch',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Improve hip range for stemming, drop-knees, and wide stances.',
  },
  {
    id: 'shoulder-chest-stretch',
    name: 'Shoulder, chest & biceps stretch',
    category: 'flexibility',
    triadArea: 'physical',
    hierarchyAreaId: 'conditioning',
    description: 'Open the shoulders and chest to balance pulling-dominant posture.',
  },
];
