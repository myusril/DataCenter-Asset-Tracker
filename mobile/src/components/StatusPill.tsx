import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

interface StatusPillProps {
  label: string;
  tone?: PillTone;
}

const TONES: Record<PillTone, { background: string; text: string }> = {
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
  neutral: { background: colors.neutralSoft, text: colors.textSecondary },
  accent: { background: colors.accentSoft, text: colors.accent },
};

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const palette = TONES[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  label: {
    fontSize: typography.small,
    fontWeight: '600',
  },
});
