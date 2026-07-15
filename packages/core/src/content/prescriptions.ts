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
      'Before each climb, close your eyes and rehearse the moves and the successful send in vivid detail.',
  },
  {
    title: 'Tactical breathing',
    detail:
      'On rests and before cruxes, take slow belly breaths to drop tension and stay in the performance zone.',
  },
  {
    title: 'Practice falls',
    detail:
      'On a safe overhanging route, take progressively bigger controlled falls to recalibrate your fear response.',
  },
  {
    title: 'Climb in the now',
    detail:
      'Use a one-word focus cue ("smooth", "breathe") to silence outcome thoughts and stay on the present move.',
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
      'Climb easy routes placing each foot so precisely it makes no sound — trains foot accuracy and trust.',
  },
  {
    title: 'Straight-arm hanging',
    detail:
      'Traverse keeping arms straight and weight on your skeleton, initiating moves from the hips and feet.',
  },
  {
    title: 'Downclimbing',
    detail:
      'Downclimb routes you just sent to sharpen footwork, body awareness, and movement economy.',
  },
  {
    title: 'Flash on-sight practice',
    detail:
      'On unfamiliar easy routes, read the sequence from the ground then execute it first try, deliberately.',
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
