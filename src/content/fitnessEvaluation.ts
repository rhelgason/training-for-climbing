/**
 * Fitness Evaluation — Eric J. Hörst, *Training for Climbing* (3rd ed.),
 * Appendix D. A 10-part physical benchmark, intended to be retaken annually to
 * gauge changes in conditioning. Always warm up fully and rest between tests.
 */
import type { FitnessTest } from './types';

export const FITNESS_TESTS: FitnessTest[] = [
  {
    id: 'max-pullups',
    name: 'Max pull-ups',
    instructions:
      'One set to failure on a standard bar, palms away, shoulder-width. No bouncing; full range up and down.',
    metric: 'Total pull-ups in a single set to failure',
    unit: 'reps',
  },
  {
    id: 'weighted-pullup-ratio',
    name: 'Weighted 1-rep-max pull-up',
    instructions:
      'Add weight in ~10 lb increments, resting 3 min between attempts, until you cannot complete a single pull-up.',
    metric: 'Max added weight for one pull-up ÷ body weight',
    unit: 'ratio',
  },
  {
    id: 'one-arm-lockoff',
    name: 'One-arm lock-off',
    instructions:
      'From a chin-up (palms facing), lock off at the top on one arm and release the other. Time each arm.',
    metric: 'Seconds held before the chin drops below the bar',
    unit: 'seconds',
    bilateral: true,
  },
  {
    id: 'frenchies',
    name: 'Frenchies',
    instructions:
      'Each cycle = three pull-ups separated by three different 5-second lock-off positions. Have a partner time the lock-offs.',
    metric: 'Number of cycles (or part) completed in one set',
    unit: 'cycles',
  },
  {
    id: 'fingertip-pullups',
    name: 'Fingertip pull-ups (19 mm edge)',
    instructions: 'Max pull-ups on a ~0.75 in (19 mm) fingerboard edge or doorjamb.',
    metric: 'Fingertip pull-ups in a single go',
    unit: 'reps',
  },
  {
    id: 'fingertip-lockoff',
    name: 'Fingertip lock-off (19 mm edge)',
    instructions:
      'Lock off at the top of a fingertip pull-up on a ~19 mm edge for as long as possible.',
    metric: 'Seconds held until the chin drops below the edge',
    unit: 'seconds',
  },
  {
    id: 'straight-arm-hang',
    name: 'Straight-arm bar hang',
    instructions: 'Hang from a standard bar, shoulder-width, palms away, arms straight.',
    metric: 'Seconds hung before muscle failure',
    unit: 'seconds',
  },
  {
    id: 'crunches',
    name: 'Abdominal crunches',
    instructions:
      'Knees bent ~90°, feet flat and unanchored, arms crossed on chest. Controlled — shoulder blades rise off the floor each rep.',
    metric: 'Crunches performed without stopping',
    unit: 'reps',
  },
  {
    id: 'wall-split',
    name: 'Wall split (flexibility)',
    instructions: 'Rear end no more than 6 in from the wall; legs equidistant from the floor.',
    metric: 'Distance from heels to the floor',
    unit: 'inches',
  },
  {
    id: 'high-step',
    name: 'High-step stretch (flexibility)',
    instructions:
      'Facing a wall, toes touching, one foot flat; lift the other leg to the side as high as possible without hands.',
    metric: 'Step height off the floor ÷ your height',
    unit: 'ratio',
  },
];
