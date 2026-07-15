/**
 * Self-Assessment Test — Eric J. Hörst, *Training for Climbing* (3rd ed., 2016),
 * Chapter 2. Questions transcribed verbatim from the paperback.
 *
 * Scoring scale (per question): 0 = almost always … 5 = never.
 * Each question describes a *problem*, so a HIGHER score is BETTER.
 *
 * Triad grouping: the test interleaves the three areas in a fixed
 * Mental → Technical → Physical cycle by question number (Q1 Mental,
 * Q2 Technical, Q3 Physical, Q4 Mental, …), giving 10 questions per area.
 * Column sums reveal the weakest area; the book also says to "mark a star"
 * next to any question scored 3 or lower as a specific weak spot.
 */
import type { AssessmentQuestion } from './types';

/** Rating scale labels, index 0..5. */
export const RATING_LABELS = [
  'Almost always',
  'Often',
  'About half the time',
  'Occasionally',
  'Seldom',
  'Never',
] as const;

export const MIN_RATING = 0;
export const MAX_RATING = 5;

/**
 * The book's cutoff: any question scored at or below this value should be
 * "starred" as a specific weak spot to target.
 */
export const WEAKNESS_THRESHOLD = 3;

export const SELF_ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 1,
    prompt: 'My footwork (use of feet) deteriorates during the hardest part of a climb.',
    triad: 'mental',
  },
  {
    id: 2,
    prompt: 'My forearms balloon and my grip begins to fail even on routes that are easy for me.',
    triad: 'technical',
  },
  {
    id: 3,
    prompt: 'On hard sequences, I have difficulty stepping onto critical footholds.',
    triad: 'physical',
  },
  {
    id: 4,
    prompt: 'I get anxious and tight as I head into crux sequences.',
    triad: 'mental',
  },
  {
    id: 5,
    prompt: 'My biceps (upper arms) pump out before my forearms.',
    triad: 'technical',
  },
  {
    id: 6,
    prompt: 'I have difficulty hanging on small, necessary-to-use holds.',
    triad: 'physical',
  },
  {
    id: 7,
    prompt: 'I blow sequences I have wired and know by heart.',
    triad: 'mental',
  },
  {
    id: 8,
    prompt:
      'I stall at the start of crux sequences. I end up having to hang on the rope and rest before I can give it a good, solid try.',
    triad: 'technical',
  },
  {
    id: 9,
    prompt: 'I climb three or four days in a row.',
    triad: 'physical',
  },
  {
    id: 10,
    prompt: 'I get sewing-machine leg (“Elvis leg”).',
    triad: 'mental',
  },
  {
    id: 11,
    prompt: 'I pump out on overhanging climbs no matter how big the holds.',
    triad: 'technical',
  },
  {
    id: 12,
    prompt: 'I get out of breath when I climb.',
    triad: 'physical',
  },
  {
    id: 13,
    prompt: 'I make excuses for why I might fail on a route before I even begin to climb.',
    triad: 'mental',
  },
  {
    id: 14,
    prompt: 'I miss hidden holds on routes.',
    triad: 'technical',
  },
  {
    id: 15,
    prompt: 'I have difficulty hanging on to sloping holds, pockets, and/or pinches.',
    triad: 'physical',
  },
  {
    id: 16,
    prompt:
      'I grab quickdraws, the rope, or other gear instead of risking a fall trying a hard move of which I am unsure.',
    triad: 'mental',
  },
  {
    id: 17,
    prompt: 'On a typical climb, I feel like much of my body weight is hanging on my arms.',
    triad: 'technical',
  },
  {
    id: 18,
    prompt: 'I get very sore the day after climbing at the crags.',
    triad: 'physical',
  },
  {
    id: 19,
    prompt:
      'I have difficulty visualizing myself successfully climbing the route before I leave the ground.',
    triad: 'mental',
  },
  {
    id: 20,
    prompt: 'I cannot reach key holds on difficult routes.',
    triad: 'technical',
  },
  {
    id: 21,
    prompt:
      'On overhanging routes and roofs, I have difficulty keeping my feet from cutting loose and swinging out.',
    triad: 'physical',
  },
  {
    id: 22,
    prompt:
      'While climbing, I get distracted by activity on the ground and/or I think about whether the belayer is paying attention.',
    triad: 'mental',
  },
  {
    id: 23,
    prompt: 'I have difficulty reading sequences.',
    triad: 'technical',
  },
  {
    id: 24,
    prompt: 'I get a flash pump on the first climb of the day.',
    triad: 'physical',
  },
  {
    id: 25,
    prompt: 'I have more difficulty climbing when people are watching.',
    triad: 'mental',
  },
  {
    id: 26,
    prompt: 'My feet unexpectedly pop off footholds.',
    triad: 'technical',
  },
  {
    id: 27,
    prompt: 'I experience elbow or shoulder pain when I train or climb on a regular basis.',
    triad: 'physical',
  },
  {
    id: 28,
    prompt:
      'When lead climbing a safe route, I have difficulty pushing myself to the complete limit.',
    triad: 'mental',
  },
  {
    id: 29,
    prompt: 'I have difficulty finding mid-route rest positions and shakeouts.',
    triad: 'technical',
  },
  {
    id: 30,
    prompt:
      'My first attempt on a hard route is usually better than my second or third attempts of the day.',
    triad: 'physical',
  },
];
