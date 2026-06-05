import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { GOAL_HORIZONS, type GoalHorizon } from '../../content/planning';
import { TRIAD_AREAS, TRIAD_LABELS, type TriadArea } from '../../content/types';
import type { GoalRecord } from '../../db/types';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { PlanStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';
import { validateGoalInput } from './goals';

type Props = NativeStackScreenProps<PlanStackParamList, 'GoalForm'>;

const HORIZON_OPTIONS: ChipOption<GoalHorizon>[] = GOAL_HORIZONS.map((h) => ({
  label: h.label,
  value: h.id,
}));

type TriadChoice = TriadArea | 'none';
const TRIAD_OPTIONS: ChipOption<TriadChoice>[] = [
  { label: 'None', value: 'none' },
  ...TRIAD_AREAS.map((a) => ({ label: TRIAD_LABELS[a], value: a })),
];

type DeadlineChoice = 'none' | '1w' | '1m' | '3m';
const DEADLINE_OPTIONS: ChipOption<DeadlineChoice>[] = [
  { label: 'No deadline', value: 'none' },
  { label: '1 week', value: '1w' },
  { label: '1 month', value: '1m' },
  { label: '3 months', value: '3m' },
];
const DEADLINE_DAYS: Record<Exclude<DeadlineChoice, 'none'>, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
};

export function GoalFormScreen({ navigation, route }: Props) {
  const repo = useRepository();
  const goalId = route.params?.goalId;
  const editing = Boolean(goalId);

  const [horizon, setHorizon] = useState<GoalHorizon>('medium');
  const [title, setTitle] = useState('');
  const [mission, setMission] = useState('');
  const [sacrifice, setSacrifice] = useState('');
  const [triad, setTriad] = useState<TriadChoice>('none');
  const [deadline, setDeadline] = useState<DeadlineChoice>('none');
  const [existing, setExisting] = useState<GoalRecord | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit goal' : 'New goal' });
    if (!goalId) return;
    repo.getGoal(goalId).then((g) => {
      if (!g) return;
      setExisting(g);
      setHorizon(g.horizon);
      setTitle(g.title);
      setMission(g.mission ?? '');
      setSacrifice(g.sacrifice ?? '');
      setTriad(g.triadArea ?? 'none');
    });
  }, [goalId, editing, navigation, repo]);

  const computeTargetDate = (): number | undefined => {
    if (deadline === 'none') return existing?.targetDate;
    return now() + DEADLINE_DAYS[deadline] * 24 * 60 * 60 * 1000;
  };

  const onSave = async () => {
    const validation = validateGoalInput({ title });
    if (!validation.valid) {
      Alert.alert('Add a title', validation.errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const triadArea = triad === 'none' ? undefined : triad;
      const fields = {
        horizon,
        title: title.trim(),
        mission: mission.trim() || undefined,
        sacrifice: sacrifice.trim() || undefined,
        triadArea,
        targetDate: computeTargetDate(),
      };
      if (goalId) {
        await repo.updateGoal(goalId, fields);
      } else {
        await repo.saveGoal(fields);
        trackEvent('goal_created', { horizon });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.label}>Time horizon</Text>
      <OptionChips
        options={HORIZON_OPTIONS}
        selected={horizon}
        onSelect={setHorizon}
        testIDPrefix="horizon"
      />

      <Text style={styles.label}>Goal</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Redpoint my first 5.11 by the end of summer"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        testID="goal-title"
      />

      <Text style={styles.label}>Mission statement (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Why this goal matters"
        placeholderTextColor={colors.textMuted}
        value={mission}
        onChangeText={setMission}
        multiline
      />

      <Text style={styles.label}>What I&apos;ll give up (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="The sacrifice that makes room for this goal"
        placeholderTextColor={colors.textMuted}
        value={sacrifice}
        onChangeText={setSacrifice}
        multiline
      />

      <Text style={styles.label}>Focus area (optional)</Text>
      <OptionChips
        options={TRIAD_OPTIONS}
        selected={triad}
        onSelect={setTriad}
        testIDPrefix="triad"
      />

      <Text style={styles.label}>Deadline</Text>
      <OptionChips
        options={DEADLINE_OPTIONS}
        selected={deadline}
        onSelect={setDeadline}
        testIDPrefix="deadline"
      />
      {editing && existing?.targetDate && deadline === 'none' && (
        <Text style={styles.hint}>Keeping the existing deadline unless you pick a new one.</Text>
      )}

      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Save goal'} onPress={onSave} disabled={saving} />
      </View>
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
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  actions: { marginTop: spacing.xl },
});
