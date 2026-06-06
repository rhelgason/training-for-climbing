import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AssessHomeScreen } from '../features/assess/AssessHomeScreen';
import { AssessmentScreen } from '../features/assess/AssessmentScreen';
import { ResultsScreen } from '../features/assess/ResultsScreen';
import { HistoryScreen } from '../features/assess/HistoryScreen';
import { FitnessScreen } from '../features/assess/FitnessScreen';
import { FitnessFormScreen } from '../features/assess/FitnessFormScreen';
import type { AssessStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<AssessStackParamList>();

export function AssessStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AssessHome" component={AssessHomeScreen} options={{ title: 'Assess' }} />
      <Stack.Screen
        name="Assessment"
        component={AssessmentScreen}
        options={{ title: 'Self-Assessment' }}
      />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Stack.Screen
        name="Fitness"
        component={FitnessScreen}
        options={{ title: 'Fitness evaluation' }}
      />
      <Stack.Screen
        name="FitnessForm"
        component={FitnessFormScreen}
        options={{ title: 'Record evaluation' }}
      />
    </Stack.Navigator>
  );
}
