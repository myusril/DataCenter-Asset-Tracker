import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { gradients } from '../theme/tokens';
import { text } from '../theme/typography';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  /** `hero` is the dashboard; `compact` is a sub-screen header. */
  variant?: 'hero' | 'compact';
  colors?: readonly [string, string, ...string[]];
}

/**
 * The single gradient surface of a screen: an indigo→violet hero with the
 * safe-area inset handled internally, so content can start above the fold.
 */
export function GradientHeader({
  title,
  subtitle,
  eyebrow,
  left,
  right,
  children,
  variant = 'hero',
  colors: gradientColors = gradients.hero,
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradientColors}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <View pointerEvents="none" style={styles.blobLarge} />
      <View pointerEvents="none" style={styles.blobSmall} />

      {left || right ? (
        <View style={styles.topRow}>
          <View style={styles.side}>{left}</View>
          <View style={styles.side}>{right}</View>
        </View>
      ) : null}

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, variant === 'compact' ? styles.titleCompact : null]}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {children ? <View style={styles.body}>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...text.display,
    color: colors.onPrimary,
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  eyebrow: {
    ...text.small,
    color: colors.onPrimaryMuted,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...text.body,
    color: colors.onPrimaryMuted,
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  body: {
    marginTop: spacing.xl,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 44,
  },
  side: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    minWidth: 44,
  },
  blobLarge: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    height: 220,
    position: 'absolute',
    right: -70,
    top: -60,
    width: 220,
  },
  blobSmall: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    bottom: -50,
    height: 150,
    left: -40,
    position: 'absolute',
    width: 150,
  },
});
