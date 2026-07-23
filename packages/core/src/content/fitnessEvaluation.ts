/**
 * Fitness self-tests — Eric J. Hörst, *Training for Climbing* (3rd ed., 2016).
 *
 * The 3rd edition replaced the old single "fitness evaluation" appendix with two
 * dedicated self-testing sections:
 *   • Chapter 8 — "Self-Testing of Finger Strength and Endurance" (3 tests)
 *   • Chapter 9 — "Self-Testing Pull-Muscle Strength, Power, and Endurance" (6 tests)
 *
 * Hörst recommends repeating these every training cycle (roughly quarterly) to
 * track gains year over year. Always warm up thoroughly (get through the flash
 * pump) and rest fully between attempts.
 */
import type { FitnessTest } from './types';

export const FITNESS_TESTS: FitnessTest[] = [
  // --- Finger strength & endurance (Chapter 8) ---
  {
    id: 'finger-strength-hang',
    name: 'Finger strength — max added weight (10 mm)',
    instructions:
      'On a 10 mm (half finger-pad) edge, half-crimp with no thumb lock, find the most weight you can add (via weights on the belay loop) and still hang for 5 seconds. Extensive warm-up first; rest ≥3 min between hangs. Always test on the same 10 mm hold.',
    metric: 'Max added weight for a 5 s hang ÷ body weight (elite ≈ 0.33+)',
    unit: 'ratio',
  },
  {
    id: 'finger-endurance-repeaters',
    name: 'Finger endurance — 5-on / 5-off repeaters (10 mm)',
    instructions:
      'On a 10 mm edge (half-crimp, open-crimp, or open-hand), have a partner time repeated 5-second hangs with exactly 5 seconds of rest between each. The test ends when you can no longer hang for 5 seconds.',
    metric: 'Total time sustained before failure',
    unit: 'seconds',
  },
  {
    id: 'finger-endurance-hang',
    name: 'Finger endurance — max hang (20 mm)',
    instructions:
      'Hang as long as possible from a 20 mm edge using a half-crimp or open-hand grip; you may pull with your arms for a true max. Do two tests ≥15 min apart. Typical results 20 s–2 min (a good anaerobic-lactic gauge; ~45 s is a solid all-round mark).',
    metric: 'Longest single hang',
    unit: 'seconds',
  },

  // --- Pull-muscle strength, power & endurance (Chapter 9) ---
  {
    id: 'weighted-pullup-ratio',
    name: 'Max strength — weighted one-rep pull-up',
    instructions:
      'Clip free weights to the belay loop and add weight in ~10 lb increments (rest 3 min between attempts) to find the most you can add and still do one complete pull-up.',
    metric: 'Max added weight for one pull-up ÷ body weight',
    unit: 'ratio',
  },
  {
    id: 'weighted-5rep-pullup',
    name: 'Max strength — weighted five-rep pull-up',
    instructions:
      'As above, but find the most added weight that still allows five complete pull-ups. Expect this to take a few sessions of trial and error.',
    metric: 'Max added weight for five pull-ups',
    unit: 'lb',
  },
  {
    id: 'rope-climb-power',
    name: 'Power — 20 ft rope climb (timed)',
    instructions:
      'Using a 1.5-inch gym rope, have a partner time you from first movement (standing, flat feet) until you touch the clasp at the top — usually 6–12 arm pulls. Advanced climbers may start seated. Faster is better.',
    metric: 'Time to climb 20 ft',
    unit: 'seconds',
  },
  {
    id: 'campus-ladder-power',
    name: 'Power — campus 1-3-5-7 ladder (timed)',
    instructions:
      'On the largest campus rungs, start with both hands on rung 1. The clock starts on first movement and stops when both hands match on rung 7. Faster is better.',
    metric: 'Time to ladder 1-3-5-7',
    unit: 'seconds',
  },
  {
    id: 'campus-slap-power',
    name: 'Power — campus max slap (reach)',
    instructions:
      'From both hands on the lowest large rung, pull hard (no feet) and slap as high as possible with your dominant hand (do not latch a high rung at full extension). Take the best of three slaps; measure from the top of the start rung to your high point.',
    metric: 'Max slap distance above the start rung',
    unit: 'inches',
  },
  {
    id: 'max-pullups',
    name: 'Strength-endurance — max pull-ups',
    instructions:
      'After a thorough warm-up, do one maximal set of pull-ups to failure. Each rep starts from nearly straight arms (no shrugged dead-hang) and ends with the chin above the bar.',
    metric: 'Pull-ups in a single set to failure',
    unit: 'reps',
  },
];
