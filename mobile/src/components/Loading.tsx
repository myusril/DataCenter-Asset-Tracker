import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';

interface LoadingProps {
  message?: string;
}

/** Inline spinner for screens that are not moved to skeletons yet. */
export function Loading({ message = 'Memuat data...' }: LoadingProps) {
  return (
    <View accessibilityLabel={message} accessibilityRole="progressbar" style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
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
    ...text.caption,
    color: colors.muted,
  },
});
