/** Vocabulary for the daily journal (a quick "what I did" log). */

export type ActivityTag =
  | 'climbing'
  | 'fingerboard'
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'rest'
  | 'other';

export type JournalIntensity = 'easy' | 'moderate' | 'hard';

export const ACTIVITY_TAGS: ActivityTag[] = [
  'climbing',
  'fingerboard',
  'strength',
  'cardio',
  'mobility',
  'rest',
  'other',
];

export const ACTIVITY_LABELS: Record<ActivityTag, string> = {
  climbing: 'Climbing',
  fingerboard: 'Fingerboard',
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  rest: 'Rest',
  other: 'Other',
};

export const INTENSITIES: JournalIntensity[] = ['easy', 'moderate', 'hard'];

export const INTENSITY_LABELS: Record<JournalIntensity, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
};

/** A day counts as training if it has any activity other than (only) rest. */
export function isTrainingActivity(activities: ActivityTag[]): boolean {
  return activities.some((a) => a !== 'rest');
}
