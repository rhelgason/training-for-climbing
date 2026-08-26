import {
  type ClimbDiscipline,
  type ClimbEnvironment,
  type ClimbOutcome,
  DISCIPLINE_LABELS,
  DISCIPLINES,
  ENVIRONMENT_LABELS,
  ENVIRONMENTS,
  gradesForDiscipline,
  OUTCOME_LABELS,
  OUTCOMES,
} from '@tfc/core';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { DayPicker } from '../../components/DayPicker';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { ProgressStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<ProgressStackParamList, 'ClimbForm'>;

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

export function ClimbFormScreen({ navigation, route }: Props) {
  const repo = useRepository();
  const climbId = route.params?.climbId;
  const editing = Boolean(climbId);

  const [day, setDay] = useState(() => now());
  const [existingDate, setExistingDate] = useState<number | null>(null);
  const [environment, setEnvironment] = useState<ClimbEnvironment>('indoor');
  const [discipline, setDiscipline] = useState<ClimbDiscipline>('boulder');
  const [grade, setGrade] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ClimbOutcome>('send');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit climb' : 'Log climb' });
    if (!climbId) return;
    repo.getClimb(climbId).then((c) => {
      if (!c) return;
      setExistingDate(c.date);
      setEnvironment(c.environment);
      setDiscipline(c.discipline);
      setGrade(c.grade);
      setOutcome(c.outcome);
      setName(c.name ?? '');
      setLocation(c.location ?? '');
      setNotes(c.notes ?? '');
    });
  }, [climbId, editing, navigation, repo]);

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
      const fields = {
        environment,
        discipline,
        grade,
        outcome,
        name: name.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (climbId) {
        await repo.updateClimb(climbId, fields);
      } else {
        await repo.saveClimb({ ...fields, date: day });
        trackEvent('climb_logged', { discipline, environment, grade, outcome });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Screen>
      <Text style={styles.label}>When</Text>
      {editing ? (
        <Text style={styles.dateText}>{existingDate ? formatDate(existingDate) : '—'}</Text>
      ) : (
        <DayPicker value={day} onChange={setDay} />
      )}

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
        label={saving ? 'Saving…' : editing ? 'Save changes' : 'Log climb'}
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
  dateText: { color: colors.text, fontSize: fontSize.md },
  save: { marginTop: spacing.xl },
});
