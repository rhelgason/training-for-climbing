import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ReviewHomeScreen } from '../features/review/ReviewHomeScreen';
import { GlossaryScreen } from '../features/review/GlossaryScreen';
import type { ReviewStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<ReviewStackParamList>();

export function ReviewStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ReviewHome" component={ReviewHomeScreen} options={{ title: 'Review' }} />
      <Stack.Screen name="Glossary" component={GlossaryScreen} options={{ title: 'Glossary' }} />
    </Stack.Navigator>
  );
}
