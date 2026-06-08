/**
 * Shared types for the AI Coach. The context is what the app sends to its own
 * server (which calls the LLM); the suggestion is the structured reply.
 */
import type { TriadArea } from '../../content/types';

/** A compact, privacy-reviewed snapshot of the user's training picture. */
export interface CoachContext {
  /** When the context was assembled (epoch ms). */
  generatedAt: number;
  profile: { abilityTier: string };
  assessment: {
    takenAt: number;
    mental: number;
    technical: number;
    physical: number;
    weakestArea: TriadArea;
  } | null;
  /** Fitness-benchmark highlights: latest value + recent direction. */
  fitness: { test: string; latest: number; trend: 'up' | 'down' | 'flat' | 'new' }[];
  climbing: {
    sessionsLast30Days: number;
    sendRate: number;
    hardestSends: { discipline: string; grade: string }[];
  };
  goals: { horizon: string; title: string }[];
  /** Most recent journal entries (newest first), free text included. */
  journals: {
    date: number;
    activities: string[];
    intensity?: string;
    summary?: string;
    wins?: string;
    struggles?: string;
  }[];
  training: { currentStreak: number; daysLast14: number };
}

/** Structured coaching reply. Mirrors the deterministic baseline's shape. */
export interface CoachSuggestion {
  focusArea: TriadArea | null;
  headline: string;
  plan: string[];
  rationale: string;
  watchOuts: string[];
}
