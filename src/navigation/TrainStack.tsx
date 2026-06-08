import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TrainHomeScreen } from '../features/train/TrainHomeScreen';
import { JournalFormScreen } from '../features/journal/JournalFormScreen';
import { EnergyEmotionScreen } from '../features/train/EnergyEmotionScreen';
import { CheckinFormScreen } from '../features/train/CheckinFormScreen';
import { ExercisesScreen } from '../features/train/ExercisesScreen';
import type { TrainStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<TrainStackParamList>();

export function TrainStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="TrainHome" component={TrainHomeScreen} options={{ title: 'Train' }} />
      <Stack.Screen
        name="JournalForm"
        component={JournalFormScreen}
        options={{ title: 'Log today' }}
      />
      <Stack.Screen
        name="EnergyEmotion"
        component={EnergyEmotionScreen}
        options={{ title: 'Energy & emotion' }}
      />
      <Stack.Screen
        name="CheckinForm"
        component={CheckinFormScreen}
        options={{ title: 'Check-in' }}
      />
      <Stack.Screen
        name="Exercises"
        component={ExercisesScreen}
        options={{ title: 'Exercise library' }}
      />
    </Stack.Navigator>
  );
}
