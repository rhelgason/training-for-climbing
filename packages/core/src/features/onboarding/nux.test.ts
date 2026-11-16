import type { ProfileRecord } from '../../db/types';
import { PROFILE_DEFAULTS } from '../../content/profile';
import { currentNuxStep, type NuxInput } from './nux';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

const profile = (over: Partial<ProfileRecord> = {}): ProfileRecord => ({
  id: 'profile',
  createdAt: NOW,
  updatedAt: NOW,
  ...PROFILE_DEFAULTS,
  onboardedAt: NOW,
  ...over,
});

const input = (over: Partial<NuxInput> = {}): NuxInput => ({
  profile: profile(),
  assessments: 0,
  goals: 0,
  checkedInToday: false,
  activityDates: [],
  nowMs: NOW,
  ...over,
});

describe('currentNuxStep', () => {
  it('waits for sign-up to make a profile', () => {
    expect(currentNuxStep(input({ profile: null }))).toBeNull();
  });

  it('walks assessment, goal, check-in, then the plan, in that order', () => {
    expect(currentNuxStep(input())).toBe('assess');
    expect(currentNuxStep(input({ goals: 1 }))).toBe('assess');
    expect(currentNuxStep(input({ assessments: 1 }))).toBe('goal');
    expect(currentNuxStep(input({ assessments: 1, goals: 1 }))).toBe('checkin');
    expect(currentNuxStep(input({ assessments: 1, goals: 1, checkedInToday: true }))).toBe('plan');
  });

  it('is finished once stamped, whatever is missing', () => {
    expect(currentNuxStep(input({ profile: profile({ nuxCompletedAt: NOW }) }))).toBeNull();
  });

  it('never sends an account with a week of history through it', () => {
    expect(currentNuxStep(input({ activityDates: [NOW - 7 * DAY] }))).toBeNull();
    // Logging on day one does not make them established.
    expect(currentNuxStep(input({ activityDates: [NOW - DAY] }))).toBe('assess');
  });
});
