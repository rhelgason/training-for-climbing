import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AssessStack } from './AssessStack';
import { PlanStack } from './PlanStack';
import { ProgressStack } from './ProgressStack';
import { MoreStack } from './MoreStack';
import { TrainStack } from './TrainStack';
import type { RootTabParamList } from './types';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, string> = {
  Assess: '🎯',
  Plan: '🗺️',
  Train: '💪',
  Progress: '📈',
  More: '⚙️',
};

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.6 }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Assess" component={AssessStack} />
      <Tab.Screen name="Plan" component={PlanStack} />
      <Tab.Screen name="Train" component={TrainStack} />
      <Tab.Screen name="Progress" component={ProgressStack} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}
