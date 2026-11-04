import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontFamily, text } from '../theme/typography';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

interface StatusPillProps {
  label: string;
  tone?: PillTone;
  showDot?: boolean;
  style?: ViewStyle;
}

/** Soft status chip: semantic dot + text-safe ink colour. */
const TONES: Record<PillTone, { background: string; dot: string; ink: string }> = {
  success: { background: colors.successSoft, dot: colors.success, ink: colors.successInk },
  warning: { background: colors.warningSoft, dot: colors.warning, ink: colors.warningInk },
  danger: { background: colors.dangerSoft, dot: colors.danger, ink: colors.dangerInk },
  neutral: { background: colors.mutedSurface, dot: colors.textSecondary, ink: colors.textSecondary },
  accent: { background: colors.accentSoft, dot: colors.primary, ink: colors.primary },
};

export function StatusPill({ label, tone = 'neutral', showDot = true, style }: StatusPillProps) {
  const palette = TONES[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.background }, style]}>
      {showDot ? <View style={[styles.dot, { backgroundColor: palette.dot }]} /> : null}
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    minHeight: 26,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  dot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  label: {
    ...text.small,
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
  },
});
