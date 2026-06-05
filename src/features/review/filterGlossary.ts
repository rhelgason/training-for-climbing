import type { GlossaryEntry } from '../../content/types';

/**
 * Case-insensitive filter over glossary terms and definitions.
 * An empty/whitespace query returns all entries unchanged.
 */
export function filterGlossary(entries: GlossaryEntry[], query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return entries;
  return entries.filter(
    (e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
  );
}
