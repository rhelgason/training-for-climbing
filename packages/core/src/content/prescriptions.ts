/**
 * Practice prescriptions — concrete, do-it-today drills for each performance-triad
 * area, drawn from Eric J. Hörst, *Training for Climbing* (3rd ed.).
 *
 * The exercise library (`exercises.ts`) only covers the *physical* conditioning
 * chapters. The mental (Ch. 3) and technical (Ch. 4) game can't be expressed as
 * sets-and-reps, so this module supplies short skill/mental drills that the daily
 * baseline can prescribe when those areas are the weakness.
 */
import type { TriadArea } from './types';

export interface Prescription {
  /** Short imperative title, e.g. "Silent feet". */
  title: string;
  /** One-line how-to. */
  detail: string;
}

/**
 * Mental-game drills (Ch. 3): visualization, breathing/relaxation, and
 * controlled exposure to the fear of falling.
 */
export const MENTAL_PRESCRIPTIONS: Prescription[] = [
  {
    title: 'Pre-climb visualization',
    detail:
      'Before each climb, close your eyes and rehearse the moves and the successful send in vivid detail — 2 minutes, once from behind your own eyes and once watching yourself send.',
  },
  {
    title: 'Tactical breathing',
    detail:
      'On rests and before cruxes, take slow belly breaths (5 breaths of ~10 s at the ground, 3 at each rest) to drop tension and stay in the performance zone.',
  },
  {
    title: 'Practice falls',
    detail:
      'On a safe overhanging route with a competent belayer, take 3–5 progressively bigger controlled falls to recalibrate your fear response. Stop if anything feels structurally wrong.',
  },
  {
    title: 'Climb in the now',
    detail:
      'Use a one-word focus cue ("smooth", "breathe", "feet") on every climb today to silence outcome thoughts and stay on the present move.',
  },
];

/**
 * Technical / skill drills (Ch. 4): deliberate footwork and movement practice on
 * terrain within your limit, where attention can go to quality, not survival.
 */
export const TECHNICAL_PRESCRIPTIONS: Prescription[] = [
  {
    title: 'Silent feet',
    detail:
      'Climb easy routes placing each foot so precisely it makes no sound — 15–20 min, 1–2 grades below your limit. If a foot scrapes, reverse and replace it.',
  },
  {
    title: 'Straight-arm hanging',
    detail:
      'Traverse 10–15 min keeping arms straight and weight on your skeleton, initiating moves from the hips and feet. Rest the moment you start pulling with bent arms.',
  },
  {
    title: 'Downclimbing',
    detail:
      'Downclimb every route or problem you send today. Lead with the feet, keep hips in, no jumping off. This is the drill — the send is just the setup.',
  },
  {
    title: 'Flash on-sight practice',
    detail:
      'On 4–6 unfamiliar easy routes, read the sequence from the ground (30–60 s), then execute it first try. No mid-climb invention. If you fall, sit, re-read, try once more.',
  },
];

/**
 * Prescriptions for the non-physical triad areas. Physical-area drills come from
 * the tagged exercise library (by hierarchy order), not from here.
 */
export const PRESCRIPTIONS_BY_AREA: Record<Exclude<TriadArea, 'physical'>, Prescription[]> = {
  mental: MENTAL_PRESCRIPTIONS,
  technical: TECHNICAL_PRESCRIPTIONS,
};
