/**
 * Light-theme palette. `success`/`warning`/`danger` are the document's
 * green/amber/red status colours and are only used as fills (rails, dots,
 * chart arcs). The matching `*Ink` values are the text-safe variants and all
 * meet WCAG AA 4.5:1 on their soft backgrounds.
 */
export const colors = {
  primary: '#4F46E5',
  accent: '#4F46E5',
  accentSoft: '#EEF2FF',

  background: '#F7F8FC',
  surface: '#FFFFFF',
  mutedSurface: '#F1F4F9',
  border: '#E6EAF2',
  overlay: 'rgba(11, 18, 32, 0.45)',

  text: '#0B1220',
  textSecondary: '#5B6472',
  muted: '#5B6472',
  placeholder: '#6B7484',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.9)',

  success: '#16A34A',
  successInk: '#15803D',
  successSoft: '#E7F8EE',
  warning: '#D97706',
  warningInk: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerInk: '#B91C1C',
  dangerSoft: '#FEE2E2',
} as const;
