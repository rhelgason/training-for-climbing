import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { colors } from '../theme';

/** Shared native-stack header styling for the dark theme. */
export const screenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.text },
  headerTintColor: colors.primary,
  contentStyle: { backgroundColor: colors.background },
};
