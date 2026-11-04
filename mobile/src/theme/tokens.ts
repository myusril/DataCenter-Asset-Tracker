import { Easing, type ViewStyle } from 'react-native';

import { colors } from './colors';

/** One soft shadow layer; no glassmorphism, no blur. */
export const elevation: Record<'card' | 'floating' | 'tabBar', ViewStyle> = {
  card: {
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  floating: {
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
  },
  tabBar: {
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
  },
};

export const gradients = {
  hero: ['#4F46E5', '#7C3AED'] as const,
  heroDeep: ['#4338CA', '#7C3AED'] as const,
  primaryButton: ['#4F46E5', '#6D3BE4'] as const,
  skeleton: ['rgba(241,244,249,0.0)', 'rgba(255,255,255,0.9)', 'rgba(241,244,249,0.0)'] as const,
};

/**
 * Every transition stays at or below 250 ms. Indeterminate shimmer uses the
 * single short sweep in `Skeleton`, so the same budget applies.
 */
export const motion = {
  fast: 140,
  base: 200,
  slow: 240,
  easing: Easing.out(Easing.cubic),
} as const;

export const layout = {
  /** Keeps scroll content clear of the floating tab bar. */
  tabBarClearance: 112,
  screenPadding: 20,
  sectionGap: 20,
} as const;

export const chartColors = {
  active: colors.success,
  maintenance: colors.warning,
  inactive: colors.textSecondary,
  riskLow: colors.success,
  riskMedium: colors.warning,
  riskHigh: colors.danger,
  type: '#4F46E5',
  typeMuted: '#A5B4FC',
  track: '#EEF1F7',
} as const;

/** Shared gradient stops for the SVG gauge. */
export const gaugeGradient = {
  start: '#4F46E5',
  end: '#7C3AED',
} as const;

export const STATUS_GRADIENTS = {
  ACTIVE: ['#15803D', '#16A34A'] as const,
  MAINTENANCE: ['#B45309', '#D97706'] as const,
  INACTIVE: ['#334155', '#526175'] as const,
} as const;
