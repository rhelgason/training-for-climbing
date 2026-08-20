/**
 * @tfc/core — platform-neutral domain logic shared by the mobile app and the web
 * app. Contains NO react-native and NO DOM dependencies: data model, static book
 * content, the deterministic training logic, sync/merge, and the HTTP clients.
 */

// ── Data model & repository ────────────────────────────────────────────────
export * from './db/types';
export * from './db/repository';
export { InMemoryRepository } from './db/inMemoryRepository';

// ── Static book content ────────────────────────────────────────────────────
export * from './content/types';
export * from './content/climbing';
export * from './content/exercises';
export * from './content/fitnessEvaluation';
export * from './content/glossary';
export * from './content/journal';
export * from './content/planning';
export * from './content/prescriptions';
export * from './content/profile';
export * from './content/selfAssessment';
export * from './content/trainingContext';
export * from './content/grades';

// ── Domain logic ───────────────────────────────────────────────────────────
export * from './features/assess/scoring';
export * from './features/assess/fitness';
export * from './features/assess/reassessment';
export * from './features/today/recommend';
export * from './features/train/log';
export * from './features/train/load';
export * from './features/train/energyEmotion';
export * from './features/train/exercises';
export * from './features/plan/goals';
export * from './features/plan/macrocycle';
export * from './features/plan/microcycle';
export * from './features/plan/program';
export * from './features/progress/dashboard';
export * from './features/review/filterGlossary';

// ── Sync ───────────────────────────────────────────────────────────────────
export * from './features/sync/engine';
export * from './features/sync/merge';
export * from './features/sync/httpRemote';
export * from './features/sync/syncConfig';

// ── AI coach ───────────────────────────────────────────────────────────────
export * from './features/coach/types';
export * from './features/coach/context';
export * from './features/coach/coachClient';
export * from './features/coach/format';

// ── Auth ───────────────────────────────────────────────────────────────────
export * from './features/auth/authClient';

// ── Libraries ──────────────────────────────────────────────────────────────
export * from './lib/ids';
export * from './lib/clock';
export * from './lib/logger';
