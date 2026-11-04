import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { elevation, motion } from '../theme/tokens';
import { text } from '../theme/typography';

interface SegmentedTabsProps<T extends string> {
  items: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
  accessibilityLabel?: string;
}

/** In-card tab switcher with a sliding white pill behind the active label. */
export function SegmentedTabs<T extends string>({
  items,
  active,
  onChange,
  accessibilityLabel,
}: SegmentedTabsProps<T>) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="tablist" style={styles.container}>
      {items.map((item) => (
        <Tab
          active={item.key === active}
          key={item.key}
          label={item.label}
          onPress={() => onChange(item.key)}
        />
      ))}
    </View>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
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
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={styles.tab}
    >
      <Animated.View pointerEvents="none" style={[styles.activePill, { opacity: fade }]} />
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={1}
        style={[styles.label, active ? styles.labelActive : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 2,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  activePill: {
    ...elevation.card,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    bottom: 3,
    left: 3,
    position: 'absolute',
    right: 3,
    top: 3,
  },
  label: {
    ...text.captionStrong,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
  },
});
