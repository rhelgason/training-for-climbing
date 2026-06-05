import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { now } from '../../lib/clock';
import { trackEvent } from '../../lib/logger';
import { useRepository } from '../../providers/RepositoryProvider';
import type { TrainStackParamList } from '../../navigation/types';
import { colors, fontSize, radius, spacing } from '../../theme';
import { EMOTION_MAX, EMOTION_MIN, ENERGY_MAX, ENERGY_MIN, quadrantOf } from './energyEmotion';

type Props = NativeStackScreenProps<TrainStackParamList, 'CheckinForm'>;

function numberChips(min: number, max: number): ChipOption<string>[] {
  const out: ChipOption<string>[] = [];
  for (let i = min; i <= max; i += 1) out.push({ label: String(i), value: String(i) });
  return out;
}

const ENERGY_OPTIONS = numberChips(ENERGY_MIN, ENERGY_MAX);
const EMOTION_OPTIONS = numberChips(EMOTION_MIN, EMOTION_MAX);

export function CheckinFormScreen({ navigation }: Props) {
  const repo = useRepository();
  const [energy, setEnergy] = useState(5);
  const [emotion, setEmotion] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const quadrant = quadrantOf(energy, emotion);

  const onSave = async () => {
    setSaving(true);
    try {
      await repo.saveCheckin({ time: now(), energy, emotion, note: note.trim() || undefined });
      trackEvent('checkin_logged', { quadrant: quadrant.id });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.label}>Physical energy</Text>
      <Text style={styles.hint}>0 = depleted · 10 = peak</Text>
      <OptionChips
        options={ENERGY_OPTIONS}
        selected={String(energy)}
        onSelect={(v) => setEnergy(Number(v))}
        testIDPrefix="energy"
      />

      <Text style={styles.label}>Emotional mind-set</Text>
      <Text style={styles.hint}>−5 = very negative · +5 = very positive</Text>
      <OptionChips
        options={EMOTION_OPTIONS}
        selected={String(emotion)}
        onSelect={(v) => setEmotion(Number(v))}
        testIDPrefix="emotion"
      />

      <Card style={[styles.quadrantCard, quadrant.optimal && styles.optimal]}>
        <Text style={styles.quadrantTitle}>
          Quadrant {quadrant.id} — {quadrant.label}
        </Text>
        <Text style={styles.quadrantNote}>
          {quadrant.optimal
            ? 'This is the performance zone — high energy and a positive mind-set.'
            : 'Notice what put you here; it’s a cue to manage your energy or mind-set.'}
        </Text>
      </Card>

      <Text style={styles.label}>Note / trigger (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="What’s driving this energy or mood?"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
        testID="checkin-note"
      />

      <View style={styles.actions}>
        <Button label={saving ? 'Saving…' : 'Log check-in'} onPress={onSave} disabled={saving} />
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
    marginBottom: spacing.xs,
  },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm },
  quadrantCard: { marginTop: spacing.lg },
  optimal: { borderColor: colors.success },
  quadrantTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  quadrantNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
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
  actions: { marginTop: spacing.xl },
});
