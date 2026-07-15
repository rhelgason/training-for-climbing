/** Climbing domain vocabulary for logging ascents. */

export type ClimbEnvironment = 'indoor' | 'outdoor';
export type ClimbDiscipline = 'boulder' | 'lead' | 'toprope';
/** How the climb went. Send styles (best → worked) plus repeat and no-send. */
export type ClimbOutcome = 'onsight' | 'flash' | 'send' | 'repeat' | 'attempt';

export const ENVIRONMENT_LABELS: Record<ClimbEnvironment, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
};

export const DISCIPLINE_LABELS: Record<ClimbDiscipline, string> = {
  boulder: 'Boulder',
  lead: 'Lead',
  toprope: 'Top-rope',
};

export const OUTCOME_LABELS: Record<ClimbOutcome, string> = {
  onsight: 'Onsight',
  flash: 'Flash',
  send: 'Send (redpoint)',
  repeat: 'Repeat',
  attempt: 'Attempt (no send)',
};

export const ENVIRONMENTS: ClimbEnvironment[] = ['indoor', 'outdoor'];
export const DISCIPLINES: ClimbDiscipline[] = ['boulder', 'lead', 'toprope'];
export const OUTCOMES: ClimbOutcome[] = ['onsight', 'flash', 'send', 'repeat', 'attempt'];

/** Outcomes that count as a completed ascent (everything except a pure attempt). */
export const SEND_OUTCOMES: ClimbOutcome[] = ['onsight', 'flash', 'send', 'repeat'];

export function isSend(outcome: ClimbOutcome): boolean {
  return SEND_OUTCOMES.includes(outcome);
}
