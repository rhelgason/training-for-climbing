import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './providers/ErrorBoundary';
import { RepositoryProvider } from './providers/RepositoryProvider';
import { RootTabs } from './navigation/RootTabs';
import { installGlobalErrorLogging } from './lib/logger';
import { colors } from './theme';

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export default function App() {
  useEffect(() => {
    installGlobalErrorLogging();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <RepositoryProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <RootTabs />
          </NavigationContainer>
        </RepositoryProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
