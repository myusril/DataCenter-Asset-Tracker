import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing, typography } from '../theme/spacing';

interface LoadingProps {
  message?: string;
}

export function Loading({ message = 'Memuat data...' }: LoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  message: {
    color: colors.muted,
    fontSize: typography.caption,
  },
});
