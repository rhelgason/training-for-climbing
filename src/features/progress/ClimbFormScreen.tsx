import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  type ClimbDiscipline,
  type ClimbEnvironment,
  type ClimbOutcome,
} from '../../content/climbing';
import { gradesForDiscipline } from '../../content/grades';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { ProgressStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<ProgressStackParamList, 'ClimbForm'>;

type WhenChoice = 'today' | 'yesterday' | '2ago';
const WHEN_OPTIONS: ChipOption<WhenChoice>[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: '2 days ago', value: '2ago' },
];
const WHEN_OFFSET_DAYS: Record<WhenChoice, number> = { today: 0, yesterday: 1, '2ago': 2 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ENV_OPTIONS: ChipOption<ClimbEnvironment>[] = ENVIRONMENTS.map((e) => ({
  label: ENVIRONMENT_LABELS[e],
  value: e,
}));
const DISCIPLINE_OPTIONS: ChipOption<ClimbDiscipline>[] = DISCIPLINES.map((d) => ({
  label: DISCIPLINE_LABELS[d],
  value: d,
}));
const OUTCOME_OPTIONS: ChipOption<ClimbOutcome>[] = OUTCOMES.map((o) => ({
  label: OUTCOME_LABELS[o],
  value: o,
}));

export function ClimbFormScreen({ navigation }: Props) {
  const repo = useRepository();
  const [when, setWhen] = useState<WhenChoice>('today');
  const [environment, setEnvironment] = useState<ClimbEnvironment>('indoor');
  const [discipline, setDiscipline] = useState<ClimbDiscipline>('boulder');
  const [grade, setGrade] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ClimbOutcome>('send');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const gradeOptions = useMemo<ChipOption<string>[]>(
    () => gradesForDiscipline(discipline).map((g) => ({ label: g, value: g })),
    [discipline],
  );

  const onChangeDiscipline = (d: ClimbDiscipline) => {
    setDiscipline(d);
    setGrade(null); // grade scale changes with discipline
  };

  const onSave = async () => {
    if (!grade) {
      Alert.alert('Pick a grade', 'Select the grade you climbed.');
      return;
    }
    setSaving(true);
    try {
      await repo.saveClimb({
        date: now() - WHEN_OFFSET_DAYS[when] * MS_PER_DAY,
        environment,
        discipline,
        grade,
        outcome,
        name: name.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      trackEvent('climb_logged', { discipline, environment, grade, outcome });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.label}>When</Text>
      <OptionChips options={WHEN_OPTIONS} selected={when} onSelect={setWhen} testIDPrefix="when" />

      <Text style={styles.label}>Where</Text>
      <OptionChips
        options={ENV_OPTIONS}
        selected={environment}
        onSelect={setEnvironment}
        testIDPrefix="env"
      />

      <Text style={styles.label}>Discipline</Text>
      <OptionChips
        options={DISCIPLINE_OPTIONS}
        selected={discipline}
        onSelect={onChangeDiscipline}
        testIDPrefix="discipline"
      />

      <Text style={styles.label}>Grade</Text>
      <OptionChips
        options={gradeOptions}
        selected={grade}
        onSelect={setGrade}
        testIDPrefix="grade"
      />

      <Text style={styles.label}>Outcome</Text>
      <OptionChips
        options={OUTCOME_OPTIONS}
        selected={outcome}
        onSelect={setOutcome}
        testIDPrefix="outcome"
      />

      <Text style={styles.label}>Name (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Route or problem name"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Location (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Crag or gym"
        placeholderTextColor={colors.textMuted}
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Beta, how it felt, conditions…"
        placeholderTextColor={colors.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Button
        label={saving ? 'Saving…' : 'Log climb'}
        onPress={onSave}
        disabled={saving}
        style={styles.save}
      />
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
});
