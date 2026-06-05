/**
 * Self-Assessment Test — Eric J. Hörst, *Training for Climbing* (3rd ed.),
 * Chapter 2, with coaching tips paraphrased from Appendix C.
 *
 * Scoring scale (per question): 0 = almost always … 5 = never.
 * Each question describes a *problem*, so a HIGHER score is BETTER.
 * Column (triad) sums reveal the weakest area; any question scored <= 3 is a
 * flagged weakness to target.
 *
 * ⚠️ The per-question `triad` grouping below is transcribed from the book's
 * Figure 2.1 scoring grid (p. 84). It is the single source of truth — if a
 * grouping is found to differ from the printed figure, fix it here only.
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

/** A question scored at or below this value is flagged as a weakness. */
export const WEAKNESS_THRESHOLD = 3;

export const SELF_ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 1,
    prompt: 'My footwork (use of feet) deteriorates during the hardest part of a climb.',
    triad: 'technical',
    tip: 'When the going gets tough, shift your focus onto your feet — crucial footholds often unlock hard sequences.',
    chapterRefs: [3, 4],
  },
  {
    id: 2,
    prompt: 'My forearms balloon and my grip begins to fail even on routes that are easy for me.',
    triad: 'physical',
    tip: 'You are probably overgripping and/or climbing too slowly. Relax your grip, weight your feet, and move briskly between rests.',
    chapterRefs: [4],
  },
  {
    id: 3,
    prompt: 'On hard sequences, I have difficulty stepping onto critical footholds.',
    triad: 'technical',
    tip: 'Likely a flexibility or hip-flexor limitation. Stretch daily (10+ min) and practice high steps.',
    chapterRefs: [6],
  },
  {
    id: 4,
    prompt: 'I get anxious and tight as I head into crux sequences.',
    triad: 'mental',
    tip: 'Use normalized breathing: five slow deep breaths before starting, and three before each crux.',
    chapterRefs: [3],
  },
  {
    id: 5,
    prompt: 'My biceps (upper arms) pump out before my forearms.',
    triad: 'technical',
    tip: "You're hanging on bent arms. Hang 'by the bone' with straight arms whenever you pause, clip, or read sequences.",
    chapterRefs: [4],
  },
  {
    id: 6,
    prompt: 'I have difficulty hanging on small, necessary-to-use holds.',
    triad: 'physical',
    tip: 'Contact (grip) strength needs work. Train on steep walls and caves, boulder more, add some fingerboard/HIT work.',
    chapterRefs: [7],
  },
  {
    id: 7,
    prompt: 'I blow sequences I have wired and know by heart.',
    triad: 'mental',
    tip: 'Avoid inventing new beta mid-redpoint. Commit to the sequence you know works.',
    chapterRefs: [3],
  },
  {
    id: 8,
    prompt: 'I stall at the start of crux sequences and end up hanging to rest before a solid try.',
    triad: 'mental',
    tip: 'Beat paralysis by analysis: visualize two options, pick the more promising, and commit fully.',
    chapterRefs: [3],
  },
  {
    id: 9,
    prompt: 'I climb three or four days in a row.',
    triad: 'physical',
    tip: 'This invites overtraining and injury. Switch to a two-on/one-off (or one-on/one-off) schedule.',
    chapterRefs: [8, 10],
  },
  {
    id: 10,
    prompt: 'I get sewing-machine leg (“Elvis leg”).',
    triad: 'mental',
    tip: 'A sign of tension. Lengthen your warm-up and practice relaxation/centering techniques.',
    chapterRefs: [3],
  },
  {
    id: 11,
    prompt: 'I pump out on overhanging climbs no matter how big the holds.',
    triad: 'technical',
    tip: 'The pump clock starts when you leave the ground — you may be too slow, not too weak. Climb faster and hunt for rests.',
    chapterRefs: [3, 4],
  },
  {
    id: 12,
    prompt: 'I get out of breath when I climb.',
    triad: 'physical',
    tip: 'From tension, irregular breathing, or low aerobic fitness. Breathe steadily; add aerobic training (e.g. running).',
    chapterRefs: [6],
  },
  {
    id: 13,
    prompt: 'I make excuses for why I might fail on a route before I even begin to climb.',
    triad: 'mental',
    tip: 'Belief becomes reality. Always visualize a successful ascent, bottom to top, before you start.',
    chapterRefs: [3],
  },
  {
    id: 14,
    prompt: 'I miss hidden holds on routes.',
    triad: 'technical',
    tip: 'Tunnel vision. Scope the route from several vantage points and stay open to holds that take extra effort to spot.',
    chapterRefs: [3, 4],
  },
  {
    id: 15,
    prompt: 'I have difficulty hanging on to small sloping holds or pockets.',
    triad: 'physical',
    tip: 'Open-hand grip strength is crucial. Force open-hand use at least half the time; intermediates/advanced can use HIT.',
    chapterRefs: [7],
  },
  {
    id: 16,
    prompt:
      'I grab quickdraws, the rope, or gear instead of risking a fall on a hard move I am unsure of.',
    triad: 'mental',
    tip: 'Assuming the fall is safe, go for the move. Counter the urge with the belief that a good hold is just above.',
    chapterRefs: [3],
  },
  {
    id: 17,
    prompt: 'On a typical climb, I feel like much of my body weight is hanging on my arms.',
    triad: 'technical',
    tip: "You're not getting your center of gravity over your feet. Practice body positioning; keep hips near the wall.",
    chapterRefs: [4],
  },
  {
    id: 18,
    prompt: 'I get very sore the day after climbing at the crags.',
    triad: 'physical',
    tip: 'Training volume/intensity is not congruent with your outdoor goals. Add solid indoor training days.',
    chapterRefs: [8],
  },
  {
    id: 19,
    prompt: 'I have difficulty visualizing myself successfully climbing the route before I start.',
    triad: 'mental',
    tip: 'Climb each route in your mind at least twice before a real attempt.',
    chapterRefs: [3],
  },
  {
    id: 20,
    prompt: 'I cannot reach key holds on difficult routes.',
    triad: 'technical',
    tip: "There's almost always a technical solution or intermediate hold. Try a move many different ways.",
    chapterRefs: [4],
  },
  {
    id: 21,
    prompt: 'On overhangs and roofs, I have difficulty keeping my feet from cutting loose.',
    triad: 'physical',
    tip: 'Usually weak core muscles. Do core exercises twice weekly and practice steep-wall footwork.',
    chapterRefs: [6],
  },
  {
    id: 22,
    prompt: 'While climbing, I get distracted by activity on the ground or my belayer.',
    triad: 'mental',
    tip: 'Lock 95%+ of focus on the moves. A quick "watch me" settles belay concerns; then refocus.',
    chapterRefs: [3],
  },
  {
    id: 23,
    prompt: 'I have difficulty reading sequences.',
    triad: 'technical',
    tip: 'Reading comes from mileage. Climb often, and figure sequences from the ground without leaning on beta.',
    chapterRefs: [4],
  },
  {
    id: 24,
    prompt: 'I get a flash pump on the first climb of the day.',
    triad: 'physical',
    tip: 'You pushed too hard too soon. Lengthen your warm-up, add stretching, and ramp up route difficulty gradually.',
    chapterRefs: [10],
  },
  {
    id: 25,
    prompt: 'I have more difficulty climbing when people are watching.',
    triad: 'mental',
    tip: 'The pressure is self-imposed — so you can switch it off. Climb for yourself; let the outcome take care of itself.',
    chapterRefs: [3],
  },
  {
    id: 26,
    prompt: 'My feet unexpectedly pop off footholds.',
    triad: 'technical',
    tip: 'Refocus on the feet for a few weeks: place precisely on the best part of the hold and keep the foot still as you stand.',
    chapterRefs: [4],
  },
  {
    id: 27,
    prompt: 'I experience elbow pain when I climb on a regular basis.',
    triad: 'physical',
    tip: 'Do reverse wrist curls and forearm-rotation work, and stretch both sides of the forearm daily, year-round.',
    chapterRefs: [6, 11],
  },
  {
    id: 28,
    prompt:
      'When lead climbing a safe route, I have difficulty pushing myself to the complete limit.',
    triad: 'mental',
    tip: 'This is mental, not physical. On safe routes, consciously push into the discomfort zone to redefine your limits.',
    chapterRefs: [3],
  },
  {
    id: 29,
    prompt: 'I have difficulty finding midroute rest positions and shakeouts.',
    triad: 'technical',
    tip: 'Practice finding funky rests in a no-pressure setting, model other climbers, and climb varied terrain.',
    chapterRefs: [4],
  },
  {
    id: 30,
    prompt:
      'My first attempt on a hard route is usually better than my second or third of the day.',
    triad: 'physical',
    tip: 'Likely a muscular-endurance/stamina gap. Climb laps on training routes and use interval-climbing strategies.',
    chapterRefs: [7],
  },
];
