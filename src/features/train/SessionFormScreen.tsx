import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { TRAINING_HIERARCHY, type HierarchyAreaId } from '../../content/planning';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { TrainStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<TrainStackParamList, 'SessionForm'>;

const AREA_OPTIONS: ChipOption<HierarchyAreaId>[] = TRAINING_HIERARCHY.map((a) => ({
  label: a.name,
  value: a.id,
}));

type WhenChoice = 'today' | 'yesterday' | '2ago';
const WHEN_OPTIONS: ChipOption<WhenChoice>[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: '2 days ago', value: '2ago' },
];
const WHEN_OFFSET_DAYS: Record<WhenChoice, number> = { today: 0, yesterday: 1, '2ago': 2 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function SessionFormScreen({ navigation }: Props) {
  const repo = useRepository();
  const [when, setWhen] = useState<WhenChoice>('today');
  const [areas, setAreas] = useState<HierarchyAreaId[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleArea = (id: HierarchyAreaId) =>
    setAreas((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const onSave = async () => {
    setSaving(true);
    try {
      await repo.saveSession({
        date: now() - WHEN_OFFSET_DAYS[when] * MS_PER_DAY,
        focusAreas: areas,
        notes: notes.trim() || undefined,
      });
      trackEvent('session_logged', { areaCount: areas.length });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.label}>When</Text>
      <OptionChips options={WHEN_OPTIONS} selected={when} onSelect={setWhen} testIDPrefix="when" />

      <Text style={styles.label}>What did you train?</Text>
      <Text style={styles.hint}>Tag the areas of the training hierarchy you worked.</Text>
      <OptionChips
        options={AREA_OPTIONS}
        selected={areas}
        onSelect={toggleArea}
        testIDPrefix="area"
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Climbs, grades, how it felt, achievements…"
        placeholderTextColor={colors.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
        testID="session-notes"
      />

      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Save session'} onPress={onSave} disabled={saving} />
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
  hint: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  actions: { marginTop: spacing.xl },
});
