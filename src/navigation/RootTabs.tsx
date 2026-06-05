import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AssessStack } from './AssessStack';
import { ReviewStack } from './ReviewStack';
import { PlanScreen } from '../features/plan/PlanScreen';
import { TrainScreen } from '../features/train/TrainScreen';
import type { RootTabParamList } from './types';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, string> = {
  Assess: '🎯',
  Plan: '🗺️',
  Train: '💪',
  Review: '📖',
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
      <Tab.Screen name="Plan" component={PlanScreen} />
      <Tab.Screen name="Train" component={TrainScreen} />
      <Tab.Screen name="Review" component={ReviewStack} />
    </Tab.Navigator>
  );
}
