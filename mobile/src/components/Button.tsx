import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { elevation, gradients } from '../theme/tokens';
import { text } from '../theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = VARIANTS[variant];
  const content = (
    <>
      {loading ? <ActivityIndicator color={palette.text} size="small" /> : null}
      {!loading && icon ? <Ionicons color={palette.text} name={icon} size={18} /> : null}
      {!loading ? (
        <Text numberOfLines={1} style={[styles.label, { color: palette.text }]}>
          {label}
        </Text>
      ) : null}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primaryShadow : null,
        variant === 'secondary' ? styles.outlined : null,
        variant === 'ghost' ? styles.ghost : null,
        variant === 'danger' ? styles.danger : null,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradients.primaryButton}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>{content}</View>
    </Pressable>
  );
}

const VARIANTS: Record<ButtonVariant, { text: string }> = {
  primary: { text: colors.onPrimary },
  secondary: { text: colors.text },
  ghost: { text: colors.primary },
  danger: { text: colors.dangerInk },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
  },
  primaryShadow: {
    ...elevation.card,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: colors.accentSoft,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    ...text.button,
    flexShrink: 1,
  },
});
