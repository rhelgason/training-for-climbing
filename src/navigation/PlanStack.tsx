import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PlanHomeScreen } from '../features/plan/PlanHomeScreen';
import { GoalsScreen } from '../features/plan/GoalsScreen';
import { GoalFormScreen } from '../features/plan/GoalFormScreen';
import { ProgramBuilderScreen } from '../features/plan/ProgramBuilderScreen';
import { MacrocycleScreen } from '../features/plan/MacrocycleScreen';
import { MacrocycleFormScreen } from '../features/plan/MacrocycleFormScreen';
import type { PlanStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<PlanStackParamList>();

export function PlanStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="PlanHome" component={PlanHomeScreen} options={{ title: 'Plan' }} />
      <Stack.Screen name="Goals" component={GoalsScreen} options={{ title: 'Goals' }} />
      <Stack.Screen name="GoalForm" component={GoalFormScreen} options={{ title: 'New goal' }} />
      <Stack.Screen
        name="ProgramBuilder"
        component={ProgramBuilderScreen}
        options={{ title: 'Program builder' }}
      />
      <Stack.Screen
        name="Macrocycle"
        component={MacrocycleScreen}
        options={{ title: 'Macrocycle' }}
      />
      <Stack.Screen
        name="MacrocycleForm"
        component={MacrocycleFormScreen}
        options={{ title: 'New period' }}
      />
    </Stack.Navigator>
  );
}
