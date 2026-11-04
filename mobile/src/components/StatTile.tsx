import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<StatTone, { fill: string; soft: string }> = {
  primary: { fill: colors.primary, soft: colors.accentSoft },
  success: { fill: colors.successInk, soft: colors.successSoft },
  warning: { fill: colors.warningInk, soft: colors.warningSoft },
  danger: { fill: colors.dangerInk, soft: colors.dangerSoft },
  neutral: { fill: colors.textSecondary, soft: colors.mutedSurface },
};

interface StatTileProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: StatTone;
  hint?: string;
  footer?: ReactNode;
}

/** Compact metric tile; one real number from the API per tile. */
export function StatTile({ label, value, icon, tone = 'primary', hint, footer }: StatTileProps) {
  const palette = TONES[tone];

  return (
    <View style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: palette.soft }]}>
        <Ionicons color={palette.fill} name={icon} size={16} />
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={styles.value}
      >
        {value}
      </Text>
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 108,
    padding: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 28,
  },
  value: {
    ...text.metric,
  },
  label: {
    ...text.caption,
    color: colors.textSecondary,
  },
  hint: {
    ...text.small,
  },
});
