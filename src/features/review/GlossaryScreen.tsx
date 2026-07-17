import { filterGlossary, GLOSSARY } from '@tfc/core';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { trackEvent } from '../../lib/logger';
import { colors, fontSize, radius, spacing } from '../../theme';

export function GlossaryScreen() {
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
    <Screen>
      <Text style={styles.title}>Glossary</Text>
      <TextInput
        style={styles.search}
        placeholder="Search terms…"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {results.length === 0 ? (
        <Text style={styles.empty}>No terms match “{query}”.</Text>
      ) : (
        results.map((entry) => (
          <Card key={entry.term} style={styles.card}>
            <Text style={styles.term}>{entry.term}</Text>
            <Text style={styles.definition}>{entry.definition}</Text>
          </Card>
        ))
      )}
      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  empty: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.md },
  card: { marginBottom: spacing.sm },
  term: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  definition: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  footerSpace: { height: spacing.xl },
});
