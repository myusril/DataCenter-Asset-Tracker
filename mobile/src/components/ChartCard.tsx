import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { elevation } from '../theme/tokens';
import { text } from '../theme/typography';

interface ChartCardProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

/** Surface card used for every chart so titles, notes, and legend stay aligned. */
export function ChartCard({
  title,
  subtitle,
  right,
  children,
  style,
  padded = true,
}: ChartCardProps) {
  return (
    <View style={[styles.card, padded ? styles.padded : null, style]}>
      {title || right ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevation.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
  },
  padded: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...text.heading,
  },
  subtitle: {
    ...text.caption,
    color: colors.muted,
  },
});
