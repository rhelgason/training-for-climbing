'use client';

import { useMemo, useState } from 'react';
import { GLOSSARY, filterGlossary, trackEvent } from '@tfc/core';
import { Card } from '../../../components/Card';
import { PageHeader } from '../../../components/PageHeader';
import { Screen } from '../../../components/Screen';

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

export default function GlossaryPage() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => filterGlossary(GLOSSARY, query), [query]);

  const onChange = (text: string) => {
    setQuery(text);
    const trimmed = text.trim();
    if (trimmed.length >= 2) {
      trackEvent('glossary_searched', {
        query: trimmed,
        resultCount: filterGlossary(GLOSSARY, trimmed).length,
      });
    }
  };

  return (
    <>
      <PageHeader title="Glossary" />
      <Screen>
        <input
          className={inputClass}
          type="text"
          placeholder="Search terms…"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        {results.length === 0 ? (
          <p className="text-muted">No terms match “{query}”.</p>
        ) : (
          results.map((entry) => (
            <Card key={entry.term}>
              <p className="font-bold">{entry.term}</p>
              <p className="mt-1 text-sm leading-5 text-muted">{entry.definition}</p>
            </Card>
          ))
        )}
      </Screen>
    </>
  );
}
