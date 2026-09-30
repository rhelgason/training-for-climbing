/**
 * Reading recent logs for an unresolved injury — in code, not in a prompt.
 *
 * The journal is the only injury record. There is no saved injury list to
 * clear: a note accepted last month must not keep scheduling rest after the
 * writing has moved on. This reads the last few entries and today's note, and
 * that is the whole input. The scheduler decides what a finding is allowed to
 * block. Nothing here writes to the profile or the journal.
 *
 * A model asked to "remember their injuries" will keep resting them. A count
 * over the newest entries will not.
 */
import type { JournalEntry } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Newest entries only. Older prose is history, even inside a long week. */
const JOURNAL_LIMIT = 10;
/**
 * If they have not mentioned the problem in this many days, treat it as settled.
 * Healing language, and a later training session that never brings a niggle
 * back up, cancel sooner.
 */
const SILENCE_DAYS = 7;

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
  /**
   * Unused. Kept so existing callers still compile. Saved injury notes are
   * not read — the journals are the record.
   */
  derivedNotes?: Array<{ text: string; addedAt?: number } | string>;
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

/**
 * Recovery said in so many words. Narrower than `RESOLVED`: bare "cleared"
 * also matches "cleared the crux", which must not retire a finger.
 */
const RECOVERY = new RegExp(
  [
    '\\b(healed|healing|cleared up|recovered|recovery complete)',
    '(feeling better|feels better|getting better|got better|no longer|not sore anymore|pain.?free|no pain)',
    "(doesn'?t hurt|not hurting|on the mend|back to normal|all better)",
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

function journalText(journal: JournalEntry): string {
  return [journal.summary, journal.wins, journal.struggles].filter(Boolean).join(' ');
}

function mentionsRegion(text: string, region: InjuryRegion): boolean {
  if (region === 'other') return false;
  const pattern = REGION_PATTERNS.find((p) => p.region === region)?.pattern;
  return pattern ? pattern.test(text) : false;
}

function namesSomeRegion(text: string): boolean {
  return REGION_PATTERNS.some((p) => p.pattern.test(text));
}

/** Climbing, hangboard, or lifting — a session where a niggle would come back up. */
function loadedTissue(journal: JournalEntry): boolean {
  return journal.activities.some(
    (a) => a === 'climbing' || a === 'fingerboard' || a === 'strength',
  );
}

/**
 * True when this prose retires the finding. A severe problem only yields when
 * the entry names that body part. A niggle also yields to a general "feeling
 * better" that names nobody else.
 */
function wordsSettle(text: string, finding: Finding): boolean {
  if (SEVERE.test(text)) return false;
  const strong = RECOVERY.test(text);
  const legacy = RESOLVED.test(text);
  if (!strong && !legacy) return false;
  if (finding.region !== 'other' && mentionsRegion(text, finding.region)) return true;
  if (finding.region !== 'other' && namesSomeRegion(text)) return false;
  if (finding.region === 'other') return true;
  return finding.severity === 'moderate' && strong;
}

function summarise(finding: Finding): string {
  const where = finding.region === 'other' ? 'an unresolved issue' : `a ${finding.region} issue`;
  if (finding.severity === 'severe') {
    return `Logged ${where} that reads as more than post-session soreness. No hard climbing until it is cleared.`;
  }
  return `Logged ${where}. No near-limit loading until it settles.`;
}

/**
 * Scan the newest journals and today's note for an unresolved physical problem.
 * Returns the most serious current finding, or null when nothing qualifies.
 *
 * Saved injury notes and the profile blurb are not inputs. How the climber
 * feels is whatever they wrote last.
 */
export function detectInjury(input: InjuryInput): DetectedInjury | null {
  const considered = [...input.journals]
    .filter((j) => j.date <= input.nowMs)
    .sort((a, b) => b.date - a.date)
    .slice(0, JOURNAL_LIMIT);
  const findings: Finding[] = [];

  for (const journal of considered) {
    const found = classify(journalText(journal), 'journal');
    if (found) findings.push({ ...found, date: journal.date });
  }

  if (input.dailyNote) {
    const found = classify(input.dailyNote, 'today');
    if (found) findings.push({ ...found, date: input.nowMs });
  }

  if (findings.length === 0) return null;

  // Newest first. A later entry can retire a region: it says the problem
  // eased, or — for a niggle, not a tear — they trained again and didn't
  // mention it. Climbers rarely write "it's fine now". They log the next session.
  const resolved = new Set<InjuryRegion>();
  const current: Finding[] = [];
  for (const finding of [...findings].sort((a, b) => b.date - a.date)) {
    if (resolved.has(finding.region)) continue;
    const newer = considered.filter((j) => j.date > finding.date);
    const matched = considered.find((j) => j.date === finding.date);
    const own =
      finding.source === 'today'
        ? (input.dailyNote ?? finding.evidence)
        : matched
          ? journalText(matched)
          : finding.evidence;
    const newerNote = input.dailyNote && input.nowMs > finding.date ? input.dailyNote : null;
    const prose = [own, ...newer.map(journalText), ...(newerNote ? [newerNote] : [])];
    const settledByWords = prose.some((text) => wordsSettle(text, finding));
    const settledByLaterSession =
      finding.severity === 'moderate' &&
      finding.region !== 'other' &&
      newer.some((j) => loadedTissue(j) && !mentionsRegion(journalText(j), finding.region));
    if (settledByWords || settledByLaterSession) {
      resolved.add(finding.region);
      continue;
    }
    current.push(finding);
  }

  if (current.length === 0) return null;

  const silenceCutoff = input.nowMs - SILENCE_DAYS * MS_PER_DAY;
  const recent = current.filter((f) => f.date >= silenceCutoff);
  if (recent.length === 0) return null;

  recent.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'severe' ? -1 : 1;
    return b.date - a.date;
  });
  const top = recent[0];
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
