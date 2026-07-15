import type { GlossaryEntry } from '../../content/types';
import { filterGlossary } from './filterGlossary';

const entries: GlossaryEntry[] = [
  { term: 'Crux', definition: 'The hardest move on a route.' },
  { term: 'Beta', definition: 'Prior information about a route.' },
  { term: 'Dyno', definition: 'An explosive leap for a hold.' },
];

describe('filterGlossary', () => {
  it('returns all entries for an empty or whitespace query', () => {
    expect(filterGlossary(entries, '')).toHaveLength(3);
    expect(filterGlossary(entries, '   ')).toHaveLength(3);
  });

  it('matches on the term, case-insensitively', () => {
    expect(filterGlossary(entries, 'CRUX').map((e) => e.term)).toEqual(['Crux']);
  });

  it('matches on the definition', () => {
    const result = filterGlossary(entries, 'route');
    expect(result.map((e) => e.term).sort()).toEqual(['Beta', 'Crux']);
  });

  it('returns nothing when no entry matches', () => {
    expect(filterGlossary(entries, 'zzz')).toHaveLength(0);
  });
});
