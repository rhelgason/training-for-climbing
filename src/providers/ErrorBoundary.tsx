import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { log } from '../lib/logger';
import { colors, fontSize, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time errors anywhere in the tree and logs them. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error('render error caught by ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.sm },
  message: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
});
