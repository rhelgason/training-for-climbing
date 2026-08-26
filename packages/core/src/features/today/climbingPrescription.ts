/**
 * What to climb today: which grades, and in what style.
 *
 * The hangboard side of the plan needs a measured baseline before it can say a
 * number. Climbing needs nothing extra — the climber has been logging sends all
 * along, so their own pyramid already says what "hard for me" means. This turns
 * that into the four bands a session actually uses.
 *
 * The anchor is the hardest grade with at least `CONSOLIDATED_SENDS` sends in
 * the window, not the hardest single send. One lucky V6 doesn't make someone a
 * V6 climber, and anchoring on it would prescribe a whole session above their
 * real level. The consolidated grade is the one they can be expected to do
 * again today, which is the only thing a plan can be built on.
 */
import { isSend, type ClimbDiscipline } from '../../content/climbing';
import { gradeRank, gradesForDiscipline } from '../../content/grades';
import type { SessionFocusId } from '../../content/trainingContext';
import type { ClimbRecord } from '../../db/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** How far back sends still say something about today's level. */
export const PYRAMID_WINDOW_DAYS = 180;
/** Sends at a grade before it counts as consolidated rather than a one-off. */
export const CONSOLIDATED_SENDS = 3;

export type GradeConfidence = 'none' | 'provisional' | 'established';

export interface GradeBands {
  /** Easy enough to move well on while warming up. */
  warmUp: string | null;
  /** Comfortably repeatable — where volume gets done. */
  volume: string | null;
  /** Hard but achievable in a session. */
  work: string | null;
  /** Above current level; expected to take multiple sessions. */
  project: string | null;
}

export interface ClimbingPrescription {
  discipline: ClimbDiscipline;
  bands: GradeBands;
  /** The consolidated grade the bands are built around. Null when unknown. */
  anchor: string | null;
  confidence: GradeConfidence;
  /** How the anchor was arrived at, in plain language. */
  because: string;
  /** The style of climbing today's focus calls for. */
  style: string;
}

/** Offsets from the anchor grade for each band. */
const BAND_OFFSETS: Record<keyof GradeBands, number> = {
  warmUp: -3,
  volume: -1,
  work: 1,
  project: 2,
};

/**
 * What today's focus means in terms of what to actually get on. The scheduler
 * already chose the focus; this is the climbing-shaped translation of it.
 */
const STYLE_BY_FOCUS: Partial<Record<SessionFocusId, string>> = {
  skill: 'Volume on terrain you can move well on — precise feet, quiet movement, no thrashing.',
  maxStrength: 'Short, powerful boulders. Few moves, full effort, long rests between attempts.',
  power: 'Explosive boulders and dynos. Stop each set while the moves are still snappy.',
  powerEndurance:
    'Sustained routes or 4×4s — long enough to pump, with rest matched to the effort.',
  enduranceAerobic: 'Continuous easy mileage. Long, low, and never properly pumped.',
  conditioning: 'Off the wall — antagonists and core.',
  mental: 'Climb at your limit where the pressure is real: falls, run-outs, an audience.',
};

function shift(discipline: ClimbDiscipline, grade: string, by: number): string | null {
  const scale = gradesForDiscipline(discipline);
  const idx = gradeRank(discipline, grade);
  if (idx < 0) return null;
  const target = idx + by;
  if (target < 0 || target >= scale.length) return null;
  return scale[target];
}

/**
 * The consolidated grade: hardest with enough sends to be repeatable, else the
 * hardest sent at all (flagged `provisional`, since one send isn't a level).
 */
function anchorGrade(
  climbs: ClimbRecord[],
  discipline: ClimbDiscipline,
): { grade: string | null; confidence: GradeConfidence; counted: number } {
  const counts = new Map<string, number>();
  for (const c of climbs) {
    if (c.discipline !== discipline || !isSend(c.outcome)) continue;
    if (gradeRank(discipline, c.grade) < 0) continue;
    counts.set(c.grade, (counts.get(c.grade) ?? 0) + 1);
  }
  if (counts.size === 0) return { grade: null, confidence: 'none', counted: 0 };

  const byHardest = [...counts.entries()].sort(
    (a, b) => gradeRank(discipline, b[0]) - gradeRank(discipline, a[0]),
  );
  const consolidated = byHardest.find(([, count]) => count >= CONSOLIDATED_SENDS);
  if (consolidated) {
    return { grade: consolidated[0], confidence: 'established', counted: consolidated[1] };
  }
  return { grade: byHardest[0][0], confidence: 'provisional', counted: byHardest[0][1] };
}

export function prescribeClimbing(
  climbs: ClimbRecord[],
  discipline: ClimbDiscipline,
  focus: SessionFocusId | null,
  nowMs: number,
): ClimbingPrescription {
  const recent = climbs.filter(
    (c) => c.date <= nowMs && nowMs - c.date <= PYRAMID_WINDOW_DAYS * MS_PER_DAY,
  );
  const { grade, confidence, counted } = anchorGrade(recent, discipline);
  const style = (focus && STYLE_BY_FOCUS[focus]) ?? 'Climb at a level you can move well on.';

  if (!grade) {
    return {
      discipline,
      bands: { warmUp: null, volume: null, work: null, project: null },
      anchor: null,
      confidence: 'none',
      because:
        'No sends logged yet, so there is nothing to pitch grades against. Log a few sessions and the plan will start naming them.',
      style,
    };
  }

  const bands: GradeBands = {
    warmUp: shift(discipline, grade, BAND_OFFSETS.warmUp),
    volume: shift(discipline, grade, BAND_OFFSETS.volume),
    work: shift(discipline, grade, BAND_OFFSETS.work),
    project: shift(discipline, grade, BAND_OFFSETS.project),
  };

  const because =
    confidence === 'established'
      ? `Built around ${grade} — your hardest grade with ${counted} sends in the last ${Math.round(PYRAMID_WINDOW_DAYS / 30)} months.`
      : `Built around ${grade}, your hardest send so far. Only ${counted} of them, so treat these as a starting point.`;

  return { discipline, bands, anchor: grade, confidence, because, style };
}

/** The bands as one line, e.g. "warm up V1 · volume V3 · work V5 · project V6". */
export function formatBands(bands: GradeBands): string {
  const parts: string[] = [];
  if (bands.warmUp) parts.push(`warm up ${bands.warmUp}`);
  if (bands.volume) parts.push(`volume ${bands.volume}`);
  if (bands.work) parts.push(`work ${bands.work}`);
  if (bands.project) parts.push(`project ${bands.project}`);
  return parts.join(' · ');
}
