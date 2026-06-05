/**
 * Exercise library — derived from Eric J. Hörst, *Training for Climbing*,
 * Chapters 6 (general conditioning) and 7 (climbing-specific exercises).
 *
 * ⚠️ Derived from the earlier-edition PDF, not the user's 3rd-edition paperback.
 * Exercise names follow the book; the brief descriptions are paraphrased.
 * Verify specifics (especially set/rep prescriptions) against the 3rd edition.
 */
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  // --- Finger & forearm (max finger strength) ---
  {
    id: 'bouldering',
    name: 'Bouldering',
    category: 'finger-forearm',
    description:
      'Hard, low-rep climbing on boulder problems — the most fundamental way to build finger strength and power.',
  },
  {
    id: 'hypergravity-bouldering',
    name: 'Hypergravity bouldering',
    category: 'finger-forearm',
    description: 'Bouldering with added weight (weight vest/belt) to overload finger strength.',
  },
  {
    id: 'fingerboard-repeaters',
    name: 'Fingerboard repeaters',
    category: 'finger-forearm',
    description:
      'Repeated ~7s hangs with short rests on fixed edges to build finger strength and endurance.',
  },
  {
    id: 'fingerboard-pyramids',
    name: 'Fingerboard pyramids',
    category: 'finger-forearm',
    description: 'Hangs that progress through grip types/edge sizes in a pyramid of intensity.',
  },
  {
    id: 'hit',
    name: 'Hypergravity Isolation Training (HIT)',
    category: 'finger-forearm',
    description:
      'Hörst’s method: climb identical HIT-strip holds with added weight to isolate and overload each grip position.',
  },
  {
    id: 'one-arm-lunging',
    name: 'One-arm lunging',
    category: 'finger-forearm',
    description: 'Explosive one-arm moves on a wall to build contact strength and power.',
  },

  // --- Pull muscles (max strength) ---
  {
    id: 'pull-ups',
    name: 'Pull-ups & lat pull-downs',
    category: 'pull',
    description: 'Foundational pulling strength for the back and arms.',
  },
  {
    id: 'hypergravity-pull-ups',
    name: 'Hypergravity pull-ups',
    category: 'pull',
    description: 'Weighted pull-ups to overload maximum pulling strength.',
  },
  {
    id: 'uneven-grip-pull-ups',
    name: 'Uneven-grip pull-ups',
    category: 'pull',
    description: 'One hand high on the bar, one low (or on a sling) to bias load toward one arm.',
  },
  {
    id: 'one-arm-lock-offs',
    name: 'One-arm lock-offs',
    category: 'pull',
    description: 'Hold a static bent-arm position on one arm to build lock-off strength.',
  },
  {
    id: 'steep-wall-lock-off',
    name: 'Steep-wall lock-off',
    category: 'pull',
    description:
      'Lock off on steep holds to train pulling strength in a climbing-specific position.',
  },

  // --- Power ---
  {
    id: 'campus-laddering',
    name: 'Campus laddering',
    category: 'power',
    description:
      'Explosive up-and-down moves on campus rungs with no feet to build reactive power.',
  },
  {
    id: 'campus-lock-offs',
    name: 'Campus lock-offs',
    category: 'power',
    description: 'Campus-board lock-offs for static power and body tension.',
  },
  {
    id: 'campus-double-dynos',
    name: 'Campus double dynos',
    category: 'power',
    description: 'Both hands leaving and catching rungs to develop maximal explosive power.',
  },
  {
    id: 'power-pull-ups',
    name: 'Power pull-ups',
    category: 'power',
    description: 'Fast, explosive pull-ups (chest-to-bar) to train upper-body power.',
  },
  {
    id: 'big-move-boulder-problems',
    name: 'Big-move boulder problems',
    category: 'power',
    description: 'Boulder problems featuring large dynamic moves to train power on the rock.',
  },

  // --- Endurance (anaerobic) ---
  {
    id: 'traverse-training',
    name: 'Traverse training',
    category: 'endurance',
    description: 'Continuous traversing to build forearm (anaerobic) endurance and footwork.',
  },
  {
    id: 'fingerboard-moving-hangs',
    name: 'Fingerboard moving hangs',
    category: 'endurance',
    description: 'Moving between holds while hanging to extend time-under-tension for endurance.',
  },
  {
    id: 'interval-climbing',
    name: 'Interval climbing',
    category: 'endurance',
    description: 'Laps on routes/problems with timed rests to train power endurance.',
  },
  {
    id: 'tabata',
    name: 'Tabata protocol',
    category: 'endurance',
    description:
      '20s max-effort / 10s rest intervals (up to 8 rounds) — a grueling endurance stimulus.',
  },
  {
    id: 'frenchies',
    name: 'Frenchies',
    category: 'endurance',
    description:
      'Pull-ups interspersed with timed lock-offs at three positions to build strength-endurance.',
  },
  {
    id: 'pull-up-intervals',
    name: 'Pull-up intervals',
    category: 'endurance',
    description: 'Sets of pull-ups with short rests to build pulling endurance.',
  },

  // --- Core ---
  {
    id: 'abdominal-crunch',
    name: 'Abdominal crunch',
    category: 'core',
    description: 'Controlled crunches for the abdominals.',
  },
  {
    id: 'hanging-knee-lift',
    name: 'Hanging knee lift',
    category: 'core',
    description: 'Hang from a bar and raise the knees to train the lower abs and hip flexors.',
  },
  {
    id: 'side-hip-raise',
    name: 'Side hip raise',
    category: 'core',
    description: 'Side-plank hip raises for the obliques and lateral core.',
  },
  {
    id: 'aquaman',
    name: 'Aquaman',
    category: 'core',
    description: 'Prone opposite arm/leg raises for the lower back and posterior chain.',
  },
  {
    id: 'front-lever',
    name: 'Front lever',
    category: 'core',
    description: 'Advanced straight-body hang for powerful full-body tension.',
  },
  {
    id: 'one-arm-one-leg-bridge',
    name: 'One-arm, one-leg bridge',
    category: 'core',
    description: 'Anti-rotation bridge for deep core stability.',
  },

  // --- Antagonist ---
  {
    id: 'reverse-wrist-curls',
    name: 'Reverse wrist curls',
    category: 'antagonist',
    description:
      'Strengthen the forearm extensors to balance the flexors and help prevent elbow pain.',
  },
  {
    id: 'pronators',
    name: 'Forearm pronators',
    category: 'antagonist',
    description: 'Forearm rotation work to balance the forearm and protect the elbow.',
  },
  {
    id: 'shoulder-press',
    name: 'Shoulder press',
    category: 'antagonist',
    description: 'Overhead pressing for shoulder balance and health.',
  },
  {
    id: 'push-ups-bench',
    name: 'Push-ups / bench press',
    category: 'antagonist',
    description: 'Pushing strength to balance the dominant pulling muscles.',
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'antagonist',
    description: 'Triceps and chest pressing to round out antagonist conditioning.',
  },

  // --- Flexibility ---
  {
    id: 'finger-flexor-stretch',
    name: 'Finger flexor stretch & massage',
    category: 'flexibility',
    description: 'Stretch and massage the finger flexors to aid recovery and prevent tweaks.',
  },
  {
    id: 'high-step-stretch',
    name: 'Quadriceps & hip-flexor stretch',
    category: 'flexibility',
    description: 'Open the hips and hip flexors for high steps and high feet.',
  },
  {
    id: 'groin-adductor-stretch',
    name: 'Groin / adductor stretch',
    category: 'flexibility',
    description: 'Improve hip range for stemming, drop-knees, and wide stances.',
  },
  {
    id: 'shoulder-chest-stretch',
    name: 'Shoulder, chest & biceps stretch',
    category: 'flexibility',
    description: 'Open the shoulders and chest to balance pulling-dominant posture.',
  },
];
