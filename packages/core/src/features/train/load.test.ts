import type { ClimbRecord, JournalEntry } from '../../db/types';
import {
  consecutiveHardDays,
  countFocusInWeek,
  daysSinceFocus,
  inferJournalFocuses,
  isHardDay,
  loadHistory,
  recentDays,
  recentLoad,
} from './load';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function journal(dayOffset: number, partial: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: partial.id ?? `j${dayOffset}`,
    createdAt: 0,
    updatedAt: 0,
    date: NOW + dayOffset * DAY,
    activities: partial.activities ?? ['climbing'],
    ...partial,
  };
}

function climb(dayOffset: number, partial: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: partial.id ?? `c${dayOffset}`,
    createdAt: 0,
    updatedAt: 0,
    date: NOW + dayOffset * DAY,
    environment: 'indoor',
    discipline: 'boulder',
    grade: 'V5',
    outcome: 'send',
    ...partial,
  };
}

describe('inferJournalFocuses', () => {
  it('trusts a recorded focus over the tags', () => {
    const entry = journal(0, { activities: ['mobility'], focus: ['maxStrength'] });
    expect(inferJournalFocuses(entry)).toEqual(['maxStrength']);
  });

  it('treats hard fingerboard work as max strength', () => {
    expect(
      inferJournalFocuses(journal(0, { activities: ['fingerboard'], intensity: 'hard' })),
    ).toEqual(['maxStrength']);
  });

  it('treats moderate fingerboard work as power endurance (repeaters)', () => {
    expect(
      inferJournalFocuses(journal(0, { activities: ['fingerboard'], intensity: 'moderate' })),
    ).toEqual(['powerEndurance']);
  });

  it('treats hard climbing as max strength, conservatively', () => {
    const focuses = inferJournalFocuses(
      journal(0, { activities: ['climbing'], intensity: 'hard' }),
    );
    expect(focuses).toContain('maxStrength');
  });

  it('treats easy climbing as aerobic and skill work', () => {
    const focuses = inferJournalFocuses(
      journal(0, { activities: ['climbing'], intensity: 'easy' }),
    );
    expect(focuses).toEqual(expect.arrayContaining(['enduranceAerobic', 'skill']));
    expect(focuses).not.toContain('maxStrength');
  });

  it('keeps a pure rest day as rest', () => {
    expect(inferJournalFocuses(journal(0, { activities: ['rest'] }))).toEqual(['rest']);
  });

  it('drops the rest marker when real work is logged alongside it', () => {
    const focuses = inferJournalFocuses(journal(0, { activities: ['rest', 'mobility'] }));
    expect(focuses).not.toContain('rest');
    expect(focuses).toContain('conditioning');
  });

  it('defaults a missing intensity to moderate', () => {
    expect(inferJournalFocuses(journal(0, { activities: ['fingerboard'] }))).toEqual([
      'powerEndurance',
    ]);
  });
});

describe('loadHistory', () => {
  it('returns one event per day, newest first', () => {
    const history = loadHistory([journal(-2), journal(0), journal(-1)], []);
    expect(history.map((e) => e.day)).toEqual([
      history[0].day,
      history[0].day - 1,
      history[0].day - 2,
    ]);
  });

  it('merges two entries on one day, keeping the harder intensity', () => {
    const history = loadHistory(
      [
        journal(0, { id: 'a', activities: ['mobility'], intensity: 'easy' }),
        journal(0, { id: 'b', activities: ['fingerboard'], intensity: 'hard' }),
      ],
      [],
    );
    expect(history).toHaveLength(1);
    expect(history[0].intensity).toBe('hard');
    expect(history[0].focuses).toEqual(expect.arrayContaining(['conditioning', 'maxStrength']));
  });

  it('counts a climb-only day as skill work', () => {
    const history = loadHistory([], [climb(-1)]);
    expect(history[0].focuses).toEqual(['skill']);
  });

  it('lets a journal describe a day that also has climbs', () => {
    const history = loadHistory(
      [journal(-1, { activities: ['fingerboard'], intensity: 'hard' })],
      [climb(-1)],
    );
    expect(history).toHaveLength(1);
    expect(history[0].focuses).toEqual(['maxStrength']);
  });

  it('marks recorded focus as recorded', () => {
    const history = loadHistory([journal(0, { focus: ['power'] })], []);
    expect(history[0].recorded).toBe(true);
    expect(loadHistory([journal(0)], [])[0].recorded).toBe(false);
  });
});

describe('recent-load queries', () => {
  const history = loadHistory(
    [
      journal(-1, { activities: ['fingerboard'], intensity: 'hard' }), // maxStrength
      journal(-5, { activities: ['fingerboard'], intensity: 'hard' }), // maxStrength
      journal(-9, { activities: ['fingerboard'], intensity: 'hard' }), // outside the week
    ],
    [],
  );

  it('counts only sessions inside the rolling 7 days', () => {
    expect(countFocusInWeek(history, 'maxStrength', NOW)).toBe(2);
  });

  it('reports days since the most recent session of a focus', () => {
    expect(daysSinceFocus(history, 'maxStrength', NOW)).toBe(1);
    expect(daysSinceFocus(history, 'power', NOW)).toBeNull();
  });

  it('windows recent load by day count', () => {
    expect(recentLoad(history, NOW, 3)).toHaveLength(1);
    expect(recentLoad(history, NOW, 7)).toHaveLength(2);
  });
});

describe('hard-day tracking', () => {
  it('counts a high-intensity focus as a hard day even when tagged easy', () => {
    const [event] = loadHistory([journal(0, { focus: ['power'], intensity: 'easy' })], []);
    expect(isHardDay(event)).toBe(true);
  });

  it('counts consecutive hard days ending today', () => {
    const history = loadHistory(
      [
        journal(0, { activities: ['climbing'], intensity: 'hard' }),
        journal(-1, { activities: ['climbing'], intensity: 'hard' }),
        journal(-2, { activities: ['climbing'], intensity: 'hard' }),
        journal(-4, { activities: ['climbing'], intensity: 'hard' }),
      ],
      [],
    );
    expect(consecutiveHardDays(history, NOW)).toBe(3);
  });

  it('is zero when today was easy', () => {
    const history = loadHistory(
      [
        journal(0, { activities: ['mobility'], intensity: 'easy' }),
        journal(-1, { activities: ['climbing'], intensity: 'hard' }),
      ],
      [],
    );
    expect(consecutiveHardDays(history, NOW)).toBe(0);
  });
});

describe('recentDays', () => {
  it('reports how many days ago each session was, with its free text', () => {
    const days = recentDays(
      [
        journal(-1, {
          activities: ['fingerboard'],
          intensity: 'hard',
          summary: 'Max hangs felt strong',
          struggles: 'Left ring finger a bit sore',
        }),
        journal(-3, { activities: ['climbing'], intensity: 'easy' }),
      ],
      [climb(-3, { grade: 'V4', outcome: 'flash' })],
      NOW,
      5,
    );
    expect(days[0].daysAgo).toBe(1);
    expect(days[0].focusLabels).toContain('Max strength');
    expect(days[0].struggles).toBe('Left ring finger a bit sore');
    expect(days[1].daysAgo).toBe(3);
    expect(days[1].climbs).toEqual(['V4 flash']);
  });

  it('limits to the requested count', () => {
    const journals = [-1, -2, -3, -4, -5].map((o) => journal(o));
    expect(recentDays(journals, [], NOW, 3)).toHaveLength(3);
  });
});
