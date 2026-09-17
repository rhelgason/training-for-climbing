/**
 * Reading recent logs for an unresolved injury — in code, not in a prompt.
 *
 * Journal free text is the highest-signal thing the climber records, but the
 * scheduler used to ignore it. A language model asked to "take injuries into
 * account" will still prescribe a performance day; a counting problem over the
 * last few entries will not. This module only *detects*. What to do about a
 * finding is the scheduler's job.
 *
 * Nothing here writes to the profile or the journal. Existing records are the
 * input, never rewritten.
 */
import type { DerivedNote, JournalEntry } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Older than this is history, not today's constraint. */
const WINDOW_DAYS = 21;

export type InjuryRegion =
  | 'leg'
  | 'knee'
  | 'ankle'
  | 'foot'
  | 'finger'
  | 'hand'
  | 'wrist'
  | 'elbow'
  | 'shoulder'
  | 'back'
  | 'other';

export type InjurySeverity = 'severe' | 'moderate';

export interface DetectedInjury {
  severity: InjurySeverity;
  region: InjuryRegion;
  /** One line the UI, scheduler, and coach can all use. */
  summary: string;
  /** Short quote or paraphrase of what they wrote. */
  evidence: string;
  /** No climbing, hangboarding, or campusing. */
  noClimbing: boolean;
  /** No max-strength / power / power-endurance. */
  noHighIntensity: boolean;
}

export interface InjuryInput {
  journals: JournalEntry[];
  nowMs: number;
  /** Today's check-in note, if any. */
  dailyNote?: string;
  /** The climber's own profile blurb — often historical, so scored more strictly. */
  climberContext?: string;
  /** Notes they accepted from an insight card. Treated as current. */
  derivedNotes?: Array<Pick<DerivedNote, 'text'> | string>;
}

interface Finding {
  severity: InjurySeverity;
  region: InjuryRegion;
  evidence: string;
  source: 'journal' | 'today' | 'derived' | 'profile';
  date: number;
}

const REGION_PATTERNS: { region: InjuryRegion; pattern: RegExp }[] = [
  { region: 'knee', pattern: /\b(knees?|meniscus|acl|mcl|pcl)\b/i },
  { region: 'ankle', pattern: /\b(ankles?)\b/i },
  { region: 'foot', pattern: /\b(feet|foot|plantar|achilles)\b/i },
  { region: 'leg', pattern: /\b(legs?|hamstring|quads?|calf|calves|shin|thigh|hip)\b/i },
  { region: 'finger', pattern: /\b(fingers?|pulley|a2|a4|crimp)\b/i },
  { region: 'wrist', pattern: /\b(wrists?)\b/i },
  { region: 'hand', pattern: /\b(hands?)\b/i },
  { region: 'elbow', pattern: /\b(elbows?|epicondyle|golfer'?s elbow|tennis elbow)\b/i },
  { region: 'shoulder', pattern: /\b(shoulders?|rotator cuff|slap tear|labrum)\b/i },
  { region: 'back', pattern: /\b(lower back|lumbar|spine|herniat)/i },
];

/** Language that means "do not load this, at all." One mention is enough. */
const SEVERE = new RegExp(
  [
    '\\b(mri|x-?ray|surgery|surgeon|operation|orthopedic|orthopaedic)',
    '(torn|tore|tear|rupture|fracture|broken|broke|avulsion)',
    "(can'?t walk|cannot walk|can'?t climb|cannot climb|unable to climb|unable to walk)",
    '(severe|serious)\\s+\\w*\\s*(injur|sprain|strain)',
    '\\binjur(y|ed|ies)\\b',
  ].join('|'),
  'i',
);

/** Language that means "back off high-intensity," not necessarily a rest day. */
const MODERATE = new RegExp(
  [
    '\\b(tweak|tweaked|tweaky|niggle|niggled|strain|sprained|sprain)',
    '(tendon|tendin|pulley|tenosynov)',
    '(sharp pain|stabbing|swollen|swelling|inflamed)',
    '((left|right|my)\\s+\\w+\\s+(hurts?|pain|sore|aching|grumbling))',
    '\\b(hurts?|painful|in pain)\\b',
  ].join('|'),
  'i',
);

/**
 * Ordinary training cost, not an injury. Matched first so "sore forearms after
 * a hard session" never becomes a rest day.
 */
const ORDINARY = new RegExp(
  [
    '\\b(pumped|pump|flash pump|doms|delayed onset)',
    '(forearms? (are |were )?(sore|tired|pumped))',
    '(normal soreness|usual soreness|session soreness)',
  ].join('|'),
  'i',
);

/** The finding is in the past or already dealt with. */
const RESOLVED = new RegExp(
  [
    '\\b(healed|cleared up|cleared|resolved|recovered|recovery complete)',
    '(feeling better|feels better|no longer|not sore anymore|pain.?free)',
    '(coming back from|history of|old injur|years ago|last season|used to have)',
  ].join('|'),
  'i',
);

function regionOf(text: string): InjuryRegion {
  for (const { region, pattern } of REGION_PATTERNS) {
    if (pattern.test(text)) return region;
  }
  return 'other';
}

function isStructural(region: InjuryRegion): boolean {
  return region === 'leg' || region === 'knee' || region === 'ankle' || region === 'foot';
}

function snippet(text: string, max = 160): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function classify(text: string, source: Finding['source']): Finding | null {
  const body = text.trim();
  if (body.length < 4) return null;
  // Profile blurbs are lifetime context; "coming back from" is not today's constraint.
  // Journals that say it cleared up still become findings so a newer entry can
  // cancel an older one in the same region (see detectInjury below).
  if (source === 'profile' && RESOLVED.test(body)) return null;
  if (ORDINARY.test(body) && !SEVERE.test(body) && !/\binjur/i.test(body)) return null;

  if (SEVERE.test(body)) {
    const region = regionOf(body);
    return { severity: 'severe', region, evidence: snippet(body), source, date: 0 };
  }
  if (MODERATE.test(body)) {
    const region = regionOf(body);
    return { severity: 'moderate', region, evidence: snippet(body), source, date: 0 };
  }
  // "Right ring finger has been sore on crimps" is a current niggle even when
  // it doesn't use the words tweak/injury. Ordinary forearm pump is already out.
  const region = regionOf(body);
  if (region !== 'other' && /\b(sore|aching|pain|hurt)\b/i.test(body)) {
    return { severity: 'moderate', region, evidence: snippet(body), source, date: 0 };
  }
  return null;
}

function summarise(finding: Finding): string {
  const where = finding.region === 'other' ? 'an unresolved issue' : `a ${finding.region} issue`;
  if (finding.severity === 'severe') {
    return `Logged ${where} that reads as more than post-session soreness. No hard climbing until it is cleared.`;
  }
  return `Logged ${where}. No near-limit loading until it settles.`;
}

/**
 * Scan recent prose for an unresolved physical problem. Returns the most
 * serious current finding, or null when nothing qualifies.
 */
export function detectInjury(input: InjuryInput): DetectedInjury | null {
  const cutoff = input.nowMs - WINDOW_DAYS * MS_PER_DAY;
  const findings: Finding[] = [];

  for (const journal of input.journals) {
    if (journal.date < cutoff || journal.date > input.nowMs) continue;
    const text = [journal.summary, journal.wins, journal.struggles].filter(Boolean).join(' ');
    const found = classify(text, 'journal');
    if (found) findings.push({ ...found, date: journal.date });
  }

  if (input.dailyNote) {
    const found = classify(input.dailyNote, 'today');
    if (found) findings.push({ ...found, date: input.nowMs });
  }

  for (const note of input.derivedNotes ?? []) {
    const text = typeof note === 'string' ? note : note.text;
    const found = classify(text, 'derived');
    if (found) findings.push({ ...found, date: input.nowMs });
  }

  if (input.climberContext) {
    const found = classify(input.climberContext, 'profile');
    // Profile blurbs are often lifetime context. Only act when the language is
    // clearly current (MRI, can't climb, "currently") rather than a past story.
    if (found && found.severity === 'severe' && !RESOLVED.test(input.climberContext)) {
      findings.push({ ...found, date: input.nowMs - MS_PER_DAY });
    }
  }

  if (findings.length === 0) return null;

  // A newer "it cleared up" journal should cancel an older finding in the same
  // region. Walk newest-first and skip a region once it has been resolved.
  const resolved = new Set<InjuryRegion>();
  const current: Finding[] = [];
  for (const finding of [...findings].sort((a, b) => b.date - a.date)) {
    if (resolved.has(finding.region)) continue;
    const sourceText =
      finding.source === 'journal'
        ? input.journals.find((j) => j.date === finding.date)
        : undefined;
    const blob = sourceText
      ? [sourceText.summary, sourceText.wins, sourceText.struggles].filter(Boolean).join(' ')
      : finding.evidence;
    if (RESOLVED.test(blob) && !SEVERE.test(blob)) {
      resolved.add(finding.region);
      continue;
    }
    current.push(finding);
  }

  if (current.length === 0) return null;

  current.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'severe' ? -1 : 1;
    return b.date - a.date;
  });
  const top = current[0];
  const noClimbing = top.severity === 'severe' || isStructural(top.region);
  return {
    severity: top.severity,
    region: top.region,
    summary: summarise(top),
    evidence: top.evidence,
    noClimbing,
    noHighIntensity: true,
  };
}
