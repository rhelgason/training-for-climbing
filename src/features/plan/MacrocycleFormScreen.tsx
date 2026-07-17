import { formatYmd, parseYmd, validatePeriodInput } from '@tfc/core';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { PlanStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<PlanStackParamList, 'MacrocycleForm'>;

export function MacrocycleFormScreen({ navigation, route }: Props) {
  const repo = useRepository();
  const periodId = route.params?.periodId;
  const editing = Boolean(periodId);

  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [focus, setFocus] = useState('');
  const [objective, setObjective] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit period' : 'New period' });
    if (!periodId) return;
    repo.getMacrocyclePeriod(periodId).then((p) => {
      if (!p) return;
      setLabel(p.label);
      setStart(formatYmd(p.startDate));
      setEnd(formatYmd(p.endDate));
      setFocus(p.focus ?? '');
      setObjective(p.objective ?? '');
      setNotes(p.notes ?? '');
    });
  }, [periodId, editing, navigation, repo]);

  const onSave = async () => {
    const startDate = parseYmd(start);
    const endDate = parseYmd(end);
    const validation = validatePeriodInput({ label, startDate, endDate });
    if (!validation.valid) {
      Alert.alert('Check the period', validation.errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const fields = {
        label: label.trim(),
        startDate: startDate as number,
        endDate: endDate as number,
        focus: focus.trim() || undefined,
        objective: objective.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (periodId) {
        await repo.updateMacrocyclePeriod(periodId, fields);
      } else {
        await repo.saveMacrocyclePeriod(fields);
        trackEvent('macrocycle_period_created');
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.label}>Label</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Winter base"
        placeholderTextColor={colors.textMuted}
        value={label}
        onChangeText={setLabel}
        testID="period-label"
      />

      <View style={styles.dates}>
        <View style={styles.dateField}>
          <Text style={styles.label}>Start (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-01-01"
            placeholderTextColor={colors.textMuted}
            value={start}
            onChangeText={setStart}
            autoCapitalize="none"
            testID="period-start"
          />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.label}>End (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-03-31"
            placeholderTextColor={colors.textMuted}
            value={end}
            onChangeText={setEnd}
            autoCapitalize="none"
            testID="period-end"
          />
        </View>
      </View>

      <Text style={styles.label}>Training focus (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Max strength & power"
        placeholderTextColor={colors.textMuted}
        value={focus}
        onChangeText={setFocus}
      />

      <Text style={styles.label}>Climbing objective (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Send a 5.12 on the spring trip"
        placeholderTextColor={colors.textMuted}
        value={objective}
        onChangeText={setObjective}
      />

      <Text style={styles.label}>Notes / achievements (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Plan details and what you accomplished"
        placeholderTextColor={colors.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Save period'} onPress={onSave} disabled={saving} />
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
  dates: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1 },
  actions: { marginTop: spacing.xl },
});
