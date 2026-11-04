import { StyleSheet } from 'react-native';

import { colors } from './colors';

/**
 * Plus Jakarta Sans families. Weights are separate font files, so a Text must
 * name the family instead of relying on `fontWeight` (which Android would
 * otherwise synthesize or ignore).
 */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Composed text styles for the 11/12/14/16/20/28 scale. */
export const text = StyleSheet.create({
  display: {
    color: colors.text,
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  heading: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  bodyStrong: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  captionStrong: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  small: {
    color: colors.muted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 16,
  },
  /** Uppercase section label. */
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  /** Metrics: tabular so digits do not jump while counting up. */
  metric: {
    color: colors.text,
    fontFamily: fontFamily.extrabold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  metricLarge: {
    color: colors.text,
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  metricHero: {
    color: colors.onPrimary,
    fontFamily: fontFamily.extrabold,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.6,
    lineHeight: 50,
  },
  button: {
    color: colors.onPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 14,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
});
