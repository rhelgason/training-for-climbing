import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TrainHomeScreen } from '../features/train/TrainHomeScreen';
import { SessionFormScreen } from '../features/train/SessionFormScreen';
import { EnergyEmotionScreen } from '../features/train/EnergyEmotionScreen';
import { CheckinFormScreen } from '../features/train/CheckinFormScreen';
import type { TrainStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<TrainStackParamList>();

export function TrainStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="TrainHome" component={TrainHomeScreen} options={{ title: 'Train' }} />
      <Stack.Screen
        name="SessionForm"
        component={SessionFormScreen}
        options={{ title: 'Log session' }}
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
    </Stack.Navigator>
  );
}
