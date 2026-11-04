export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** 12 / 16 / 20 / 28, plus a pill radius. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Type scale: 11 / 12 / 14 / 16 / 20 / 28. */
export const typography = {
  small: 11,
  caption: 12,
  body: 14,
  heading: 16,
  title: 20,
  display: 28,
} as const;
