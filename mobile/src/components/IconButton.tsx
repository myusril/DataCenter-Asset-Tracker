import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { elevation } from '../theme/tokens';

export type IconButtonTone = 'glass' | 'soft' | 'surface';

interface IconButtonProps {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** `glass` sits on a gradient header, `soft` on a plain background. */
  tone?: IconButtonTone;
  size?: 'sm' | 'lg';
  disabled?: boolean;
}

const PALETTES: Record<IconButtonTone, { background: string; border: string; ink: string }> = {
  glass: {
    background: 'rgba(255,255,255,0.18)',
    border: 'rgba(255,255,255,0.32)',
    ink: colors.onPrimary,
  },
  soft: {
    background: colors.mutedSurface,
    border: colors.mutedSurface,
    ink: colors.textSecondary,
  },
  surface: {
    background: colors.surface,
    border: colors.border,
    ink: colors.textSecondary,
  },
};

/** Round icon-only control shared by headers, list rows, and sheet actions. */
export function IconButton({
  accessibilityLabel,
  icon,
  onPress,
  tone = 'surface',
  size = 'lg',
  disabled = false,
}: IconButtonProps) {
  const palette = PALETTES[tone];
  const dimension = size === 'lg' ? 44 : 36;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border, height: dimension, width: dimension },
        tone === 'surface' ? styles.raised : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Ionicons color={palette.ink} name={icon} size={size === 'lg' ? 20 : 17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  raised: {
    ...elevation.card,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
});
