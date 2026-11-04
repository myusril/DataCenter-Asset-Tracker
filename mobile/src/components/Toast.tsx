import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { elevation, motion } from '../theme/tokens';
import { text } from '../theme/typography';

export type ToastTone = 'success' | 'danger' | 'info';

const TONES: Record<ToastTone, { background: string; icon: keyof typeof Ionicons.glyphMap; ink: string }> = {
  success: { background: colors.successSoft, icon: 'checkmark-circle', ink: colors.successInk },
  danger: { background: colors.dangerSoft, icon: 'alert-circle', ink: colors.dangerInk },
  info: { background: colors.accentSoft, icon: 'information-circle', ink: colors.primary },
};

interface ToastProps {
  message: string | null;
  tone?: ToastTone;
  top?: number;
}

/** Floating feedback above the tab bar; the parent keeps the message alive. */
export function Toast({ message, tone = 'success', top }: ToastProps) {
  const reduced = useReducedMotion();
  const appear = useRef(new Animated.Value(message ? 1 : 0)).current;
  const palette = TONES[tone];

  useEffect(() => {
    if (reduced) {
      appear.setValue(message ? 1 : 0);
      return;
    }
    Animated.timing(appear, {
      duration: motion.base,
      easing: motion.easing,
      toValue: message ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [appear, message, reduced]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.toast,
        {
          backgroundColor: palette.background,
          opacity: appear,
          top: top ?? spacing.md,
          transform: [
            {
              translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
            },
          ],
        },
      ]}
    >
      <Ionicons color={palette.ink} name={palette.icon} size={18} />
      <Text style={[styles.message, { color: palette.ink }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    ...elevation.floating,
    alignItems: 'flex-start',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    left: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: spacing.xl,
    zIndex: 20,
  },
  message: {
    ...text.caption,
    flex: 1,
  },
});
