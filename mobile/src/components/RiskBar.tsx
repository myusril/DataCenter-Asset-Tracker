import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { motion } from '../theme/tokens';
import type { RiskLevel } from '../types/api';

const LEVEL_COLORS: Record<RiskLevel, string> = {
  LOW: colors.success,
  MEDIUM: colors.warning,
  HIGH: colors.danger,
};

interface RiskBarProps {
  score: number;
  level: RiskLevel;
  thickness?: number;
}

/** Progress bar for a 0–100 risk score, filled to the real value. */
export function RiskBar({ score, level, thickness = 8 }: RiskBarProps) {
  const reduced = useReducedMotion();
  const clamped = Math.min(Math.max(score, 0), 100);
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      duration: motion.base,
      easing: motion.easing,
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [progress, reduced]);

  return (
    <View
      accessibilityLabel={`Skor ${clamped.toFixed(1)} dari 100`}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: Math.round(clamped) }}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && Math.abs(width - trackWidth) > 0.5) {
          setTrackWidth(width);
        }
      }}
      style={[styles.track, { height: thickness }]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: LEVEL_COLORS[level],
            width:
              trackWidth === 0
                ? 0
                : progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (clamped / 100) * trackWidth],
                  }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#EEF1F7',
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.pill,
    height: '100%',
  },
});
