import {
  ACTIVITY_LABELS,
  ACTIVITY_TAGS,
  type ActivityTag,
  INTENSITIES,
  INTENSITY_LABELS,
  type JournalIntensity,
} from '@tfc/core';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { TrainStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<TrainStackParamList, 'JournalForm'>;

type WhenChoice = 'today' | 'yesterday' | '2ago';
const WHEN_OPTIONS: ChipOption<WhenChoice>[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: '2 days ago', value: '2ago' },
];
const WHEN_OFFSET_DAYS: Record<WhenChoice, number> = { today: 0, yesterday: 1, '2ago': 2 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ACTIVITY_OPTIONS: ChipOption<ActivityTag>[] = ACTIVITY_TAGS.map((a) => ({
  label: ACTIVITY_LABELS[a],
  value: a,
}));
const INTENSITY_OPTIONS: ChipOption<JournalIntensity>[] = INTENSITIES.map((i) => ({
  label: INTENSITY_LABELS[i],
  value: i,
}));

export function JournalFormScreen({ navigation, route }: Props) {
  const repo = useRepository();
  const journalId = route.params?.journalId;
  const editing = Boolean(journalId);

  const [when, setWhen] = useState<WhenChoice>('today');
  const [existingDate, setExistingDate] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityTag[]>([]);
  const [intensity, setIntensity] = useState<JournalIntensity | null>(null);
  const [summary, setSummary] = useState('');
  const [wins, setWins] = useState('');
  const [struggles, setStruggles] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit entry' : 'Log today' });
    if (!journalId) return;
    repo.getJournal(journalId).then((j) => {
      if (!j) return;
      setExistingDate(j.date);
      setActivities(j.activities);
      setIntensity(j.intensity ?? null);
      setSummary(j.summary ?? '');
      setWins(j.wins ?? '');
      setStruggles(j.struggles ?? '');
    });
  }, [journalId, editing, navigation, repo]);

  const toggleActivity = (a: ActivityTag) =>
    setActivities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const onSave = async () => {
    setSaving(true);
    try {
      const fields = {
        activities,
        intensity: intensity ?? undefined,
        summary: summary.trim() || undefined,
        wins: wins.trim() || undefined,
        struggles: struggles.trim() || undefined,
      };
      if (journalId) {
        await repo.updateJournal(journalId, fields);
      } else {
        const date = now() - WHEN_OFFSET_DAYS[when] * MS_PER_DAY;
        // One entry per day: fold into the day's existing entry rather than
        // creating a second the app can't reliably show.
        const existing = await repo.getJournalForDay(date);
        if (existing) {
          await repo.updateJournal(existing.id, fields);
        } else {
          await repo.saveJournal({ ...fields, date });
          trackEvent('journal_logged', { activityCount: activities.length });
        }
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!journalId) return;
    Alert.alert('Delete entry?', 'This permanently removes this journal entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await repo.deleteJournal(journalId);
          trackEvent('journal_deleted');
          navigation.goBack();
        },
      },
    ]);
  };

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <Screen>
      <Text style={styles.label}>When</Text>
      {editing ? (
        <Text style={styles.dateText}>{existingDate ? formatDate(existingDate) : '—'}</Text>
      ) : (
        <OptionChips
          options={WHEN_OPTIONS}
          selected={when}
          onSelect={setWhen}
          testIDPrefix="when"
        />
      )}

      <Text style={styles.label}>What did you do?</Text>
      <OptionChips
        options={ACTIVITY_OPTIONS}
        selected={activities}
        onSelect={toggleActivity}
        testIDPrefix="activity"
      />

      <Text style={styles.label}>How hard? (optional)</Text>
      <OptionChips
        options={INTENSITY_OPTIONS}
        selected={intensity}
        onSelect={setIntensity}
        testIDPrefix="intensity"
      />

      <Text style={styles.label}>What did you do today?</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="A quick blurb about your day"
        placeholderTextColor={colors.textMuted}
        value={summary}
        onChangeText={setSummary}
        multiline
        testID="journal-summary"
      />

      <Text style={styles.label}>What went well? (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Wins, breakthroughs, good feelings"
        placeholderTextColor={colors.textMuted}
        value={wins}
        onChangeText={setWins}
        multiline
      />

      <Text style={styles.label}>What didn&apos;t? (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Struggles, tweaks, frustrations"
        placeholderTextColor={colors.textMuted}
        value={struggles}
        onChangeText={setStruggles}
        multiline
      />

      <Button
        label={saving ? 'Saving…' : editing ? 'Save entry' : 'Save'}
        onPress={onSave}
        disabled={saving}
        style={styles.save}
      />
      {editing && (
        <Text style={styles.deleteLink} onPress={saving ? undefined : onDelete}>
          Delete entry
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dateText: { color: colors.text, fontSize: fontSize.md },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  save: { marginTop: spacing.xl },
  deleteLink: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
