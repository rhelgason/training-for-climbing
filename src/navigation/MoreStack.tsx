import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MoreHomeScreen } from '../features/review/MoreHomeScreen';
import { GlossaryScreen } from '../features/review/GlossaryScreen';
import { SyncScreen } from '../features/sync/SyncScreen';
import { ProfileScreen } from '../features/settings/ProfileScreen';
import type { MoreStackParamList } from './types';
import { screenOptions } from './options';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MoreHome" component={MoreHomeScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Glossary" component={GlossaryScreen} options={{ title: 'Glossary' }} />
      <Stack.Screen name="Sync" component={SyncScreen} options={{ title: 'Cloud sync' }} />
    </Stack.Navigator>
  );
}
