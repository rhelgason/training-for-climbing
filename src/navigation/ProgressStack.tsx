import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DashboardScreen } from '../features/progress/DashboardScreen';
import { ClimbsScreen } from '../features/progress/ClimbsScreen';
import { ClimbFormScreen } from '../features/progress/ClimbFormScreen';
import type { ProgressStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export function ProgressStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Progress' }} />
      <Stack.Screen name="Climbs" component={ClimbsScreen} options={{ title: 'Climbs' }} />
      <Stack.Screen name="ClimbForm" component={ClimbFormScreen} options={{ title: 'Log climb' }} />
    </Stack.Navigator>
  );
}
