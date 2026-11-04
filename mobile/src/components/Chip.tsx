import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { motion } from '../theme/tokens';
import { text } from '../theme/typography';

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

/** Single-select filter chip with an animated active fill. */
export function Chip({ label, active, onPress }: ChipProps) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      fade.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(fade, {
      duration: motion.fast,
      easing: motion.easing,
      toValue: active ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [active, fade, reduced]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Animated.View pointerEvents="none" style={[styles.fill, { opacity: fade }]} />
      <Text style={[styles.label, active ? styles.labelActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
  },
  chipActive: {
    borderColor: colors.primary,
  },
  fill: {
    backgroundColor: colors.primary,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  label: {
    ...text.captionStrong,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.onPrimary,
  },
});
