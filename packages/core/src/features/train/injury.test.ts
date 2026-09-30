import type { JournalEntry } from '../../db/types';
import { detectInjury } from './injury';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 16);

function journal(
  daysAgo: number,
  text: string,
  field: 'summary' | 'struggles' = 'struggles',
  activities: JournalEntry['activities'] = ['climbing'],
): JournalEntry {
  return {
    id: `j-${daysAgo}-${text.slice(0, 12)}`,
    createdAt: NOW - daysAgo * DAY,
    updatedAt: NOW - daysAgo * DAY,
    date: NOW - daysAgo * DAY,
    activities,
    [field]: text,
  };
}

describe('detectInjury', () => {
  it('treats a single MRI / severe-leg mention as a no-climbing constraint', () => {
    const found = detectInjury({
      journals: [journal(1, 'Potentially severe leg injury — planning to get an MRI.')],
      nowMs: NOW,
    });
    expect(found).not.toBeNull();
    expect(found?.severity).toBe('severe');
    expect(found?.region).toBe('leg');
    expect(found?.noClimbing).toBe(true);
    expect(found?.noHighIntensity).toBe(true);
    expect(found?.evidence).toMatch(/MRI/i);
  });

  it('ignores ordinary post-session forearm soreness', () => {
    expect(
      detectInjury({
        journals: [journal(0, 'Forearms are sore after a hard session, usual pump.')],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('treats a finger tweak as moderate: back off hard loading, not a medical rest day', () => {
    const found = detectInjury({
      journals: [journal(2, 'Right ring finger tweaked on a crimp.')],
      nowMs: NOW,
    });
    expect(found?.severity).toBe('moderate');
    expect(found?.region).toBe('finger');
    expect(found?.noHighIntensity).toBe(true);
    expect(found?.noClimbing).toBe(false);
  });

  it('does not treat a "coming back from" profile blurb as a current injury', () => {
    expect(
      detectInjury({
        journals: [],
        nowMs: NOW,
        climberContext: 'Coming back from a pulley strain, sport climbing outdoors in spring.',
      }),
    ).toBeNull();
  });

  it('ignores a saved injury note — the journals are the record', () => {
    expect(
      detectInjury({
        journals: [],
        nowMs: NOW,
        derivedNotes: [
          { text: 'Right ring finger has been sore on crimps since early August.' },
          'Right ring finger has been sore on crimps since early August.',
        ],
      }),
    ).toBeNull();
  });

  it("reads today's check-in note", () => {
    const found = detectInjury({
      journals: [],
      nowMs: NOW,
      dailyNote: "Knee still swollen, can't walk right. MRI Friday.",
    });
    expect(found?.noClimbing).toBe(true);
    expect(found?.region).toBe('knee');
  });

  it('ignores an injury that has fallen out of the last 10 entries', () => {
    const newer = Array.from({ length: 10 }, (_, i) => journal(0, `Easy mileage ${i}.`, 'summary'));
    // Same calendar day would tie; stamp these just after the injury so the
    // cap, not the 7-day silence rule, is what drops it.
    const injury = journal(3, 'Tore a pulley, getting an MRI');
    const recent = newer.map((j, i) => ({
      ...j,
      date: injury.date + (i + 1) * 1000,
      id: `n-${i}`,
    }));
    expect(detectInjury({ journals: [injury, ...recent], nowMs: NOW })).toBeNull();
  });

  it('does not treat a profile blurb as a hard constraint — journals decide', () => {
    expect(
      detectInjury({
        journals: [],
        nowMs: NOW,
        climberContext: "Currently can't climb — waiting on an MRI for my knee.",
      }),
    ).toBeNull();
  });

  it('drops an injury that has not been mentioned in a week', () => {
    expect(
      detectInjury({
        journals: [journal(8, 'Potentially severe leg injury — planning to get an MRI.')],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('keeps an older injury when a later journal still talks about it', () => {
    const found = detectInjury({
      journals: [
        journal(8, 'Potentially severe leg injury — planning to get an MRI.'),
        journal(1, 'Knee still swollen, waiting on that MRI.'),
      ],
      nowMs: NOW,
    });
    expect(found?.region).toBe('knee');
    expect(found?.noClimbing).toBe(true);
  });

  it('drops a niggle once a later training session never mentions it', () => {
    expect(
      detectInjury({
        journals: [
          journal(4, 'Right ring finger tweaked on a crimp.'),
          journal(1, 'Good bouldering session, felt strong.'),
        ],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('does not treat a rest-day log as proof a niggle is gone', () => {
    const found = detectInjury({
      journals: [
        journal(3, 'Right ring finger tweaked on a crimp.'),
        journal(1, 'Took the day off.', 'summary', ['rest']),
      ],
      nowMs: NOW,
    });
    expect(found?.region).toBe('finger');
    expect(found?.noHighIntensity).toBe(true);
    expect(found?.noClimbing).toBe(false);
  });

  it('keeps a severe injury when later sessions do not mention it', () => {
    const found = detectInjury({
      journals: [
        journal(3, 'Potentially severe leg injury — planning to get an MRI.'),
        journal(1, 'Easy mileage, nothing hard.'),
      ],
      nowMs: NOW,
    });
    expect(found?.region).toBe('leg');
    expect(found?.severity).toBe('severe');
    expect(found?.noClimbing).toBe(true);
  });

  it('clears a region when a later entry says it is healing', () => {
    expect(
      detectInjury({
        journals: [
          journal(4, 'Right ring finger tweaked on a crimp.'),
          journal(1, 'Finger is healing. Climbed fine, no pain.'),
        ],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('cancels an older tweak once a later journal says it cleared up', () => {
    expect(
      detectInjury({
        journals: [
          journal(5, 'Right ring finger tweaked on a crimp.'),
          journal(1, 'Finger tweak has cleared up, feeling better, no longer sore.'),
        ],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('ranks a severe finding above a moderate one on a different region', () => {
    const found = detectInjury({
      journals: [
        journal(3, 'Right ring finger tweaked on a crimp.'),
        journal(1, "Knee still swollen, can't walk right. MRI Friday."),
      ],
      nowMs: NOW,
    });
    expect(found?.region).toBe('knee');
    expect(found?.severity).toBe('severe');
  });

  it('still reads a 40-day-old note as history, not a constraint', () => {
    expect(
      detectInjury({
        journals: [journal(40, 'Tore a pulley, getting an MRI')],
        nowMs: NOW,
      }),
    ).toBeNull();
  });
});
