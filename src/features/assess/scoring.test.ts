import { SELF_ASSESSMENT_QUESTIONS } from '../../content/selfAssessment';
import { TRIAD_AREAS } from '../../content/types';
import type { Responses } from './scoring';
import {
  BALANCED_WITHIN,
  computeTriadScores,
  determineWeakestArea,
  evaluate,
  getFlaggedWeaknesses,
  isBalanced,
  isComplete,
  maxScoresByArea,
  questionCountByArea,
  unansweredQuestionIds,
} from './scoring';

/** Build a responses map that gives every question the same rating. */
function uniform(rating: number): Responses {
  return Object.fromEntries(SELF_ASSESSMENT_QUESTIONS.map((q) => [q.id, rating]));
}

/** Set specific questions to a rating, the rest to `base`. */
function withOverrides(base: number, overrides: Record<number, number>): Responses {
  return { ...uniform(base), ...overrides };
}

describe('content integrity', () => {
  it('has exactly 30 questions with unique ids 1..30', () => {
    expect(SELF_ASSESSMENT_QUESTIONS).toHaveLength(30);
    const ids = SELF_ASSESSMENT_QUESTIONS.map((q) => q.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('assigns every question to a valid triad area', () => {
    for (const q of SELF_ASSESSMENT_QUESTIONS) {
      expect(TRIAD_AREAS).toContain(q.triad);
    }
  });

  it('distributes questions evenly across the triad (10 each)', () => {
    expect(questionCountByArea()).toEqual({ mental: 10, technical: 10, physical: 10 });
  });

  it('gives every question a tip and at least one chapter reference', () => {
    for (const q of SELF_ASSESSMENT_QUESTIONS) {
      expect(q.tip.length).toBeGreaterThan(0);
      expect(q.chapterRefs.length).toBeGreaterThan(0);
    }
  });
});

describe('computeTriadScores', () => {
  it('sums ratings per area', () => {
    expect(computeTriadScores(uniform(5))).toEqual({ mental: 50, technical: 50, physical: 50 });
    expect(computeTriadScores(uniform(0))).toEqual({ mental: 0, technical: 0, physical: 0 });
    expect(computeTriadScores(uniform(3))).toEqual({ mental: 30, technical: 30, physical: 30 });
  });

  it('treats missing answers as zero', () => {
    expect(computeTriadScores({})).toEqual({ mental: 0, technical: 0, physical: 0 });
  });

  it('clamps out-of-range ratings into [0,5]', () => {
    const scores = computeTriadScores(uniform(99));
    expect(scores).toEqual(maxScoresByArea());
  });
});

describe('determineWeakestArea', () => {
  it('returns the lowest-scoring area', () => {
    const scores = { mental: 40, technical: 20, physical: 35 };
    expect(determineWeakestArea(scores)).toBe('technical');
  });

  it('breaks ties using canonical triad order (mental first)', () => {
    expect(determineWeakestArea({ mental: 10, technical: 10, physical: 10 })).toBe('mental');
    expect(determineWeakestArea({ mental: 30, technical: 10, physical: 10 })).toBe('technical');
  });
});

describe('isBalanced', () => {
  it('is balanced when all areas are within the threshold', () => {
    expect(isBalanced({ mental: 40, technical: 38, physical: 35 })).toBe(true); // spread 5
    expect(isBalanced({ mental: 40, technical: 40, physical: 40 })).toBe(true);
  });

  it('is not balanced when the spread exceeds the threshold', () => {
    expect(isBalanced({ mental: 40, technical: 38, physical: 34 })).toBe(false); // spread 6
  });

  it('uses BALANCED_WITHIN as the exact inclusive boundary', () => {
    expect(isBalanced({ mental: 0, technical: 0, physical: BALANCED_WITHIN })).toBe(true);
    expect(isBalanced({ mental: 0, technical: 0, physical: BALANCED_WITHIN + 1 })).toBe(false);
  });
});

describe('getFlaggedWeaknesses', () => {
  it('flags questions scored at or below the threshold (3)', () => {
    const responses = withOverrides(5, { 1: 3, 2: 2, 3: 4 });
    const flagged = getFlaggedWeaknesses(responses);
    const ids = flagged.map((f) => f.question.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).not.toContain(3);
  });

  it('sorts worst-first by rating then id', () => {
    const responses = withOverrides(5, { 10: 2, 4: 2, 7: 0 });
    const flagged = getFlaggedWeaknesses(responses);
    expect(flagged.map((f) => [f.question.id, f.rating])).toEqual([
      [7, 0],
      [4, 2],
      [10, 2],
    ]);
  });

  it('returns nothing when all answers are strong', () => {
    expect(getFlaggedWeaknesses(uniform(5))).toHaveLength(0);
  });
});

describe('completeness helpers', () => {
  it('isComplete is true only when all 30 questions are answered in range', () => {
    expect(isComplete(uniform(3))).toBe(true);
    expect(isComplete({})).toBe(false);
    const missingOne = uniform(3);
    delete missingOne[15];
    expect(isComplete(missingOne)).toBe(false);
  });

  it('unansweredQuestionIds lists the gaps', () => {
    const responses = uniform(3);
    delete responses[5];
    delete responses[20];
    expect(unansweredQuestionIds(responses).sort((a, b) => a - b)).toEqual([5, 20]);
  });
});

describe('evaluate', () => {
  it('bundles scores, weakest area, balance, and flags', () => {
    const responses = withOverrides(5, { 4: 1, 7: 2 }); // two mental weaknesses
    const result = evaluate(responses);
    expect(result.scores.mental).toBe(50 - 4 - 3); // q4: 5->1 (-4), q7: 5->2 (-3)
    expect(result.weakestArea).toBe('mental');
    expect(result.balanced).toBe(false);
    expect(result.flagged.map((f) => f.question.id)).toEqual([4, 7]);
    expect(result.maxPerArea).toEqual({ mental: 50, technical: 50, physical: 50 });
  });
});
