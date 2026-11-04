import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { chartColors, gaugeGradient, motion } from '../theme/tokens';
import { text } from '../theme/typography';

interface RiskGaugeProps {
  score: number;
  size?: number;
}

/**
 * Semicircular gauge for the API's `averageScore` (0–100). The arc is drawn
 * from the real value only; no trend line or target marker is invented.
 */
export function RiskGauge({ score, size = 268 }: RiskGaugeProps) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const clamped = Math.min(Math.max(score, 0), 100);
  const height = Math.round(size * 0.62);
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const centerY = radius + strokeWidth / 2;
  const path = `M ${strokeWidth / 2} ${centerY} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${centerY}`;
  const length = Math.PI * radius;

  useEffect(() => {
    if (reduced) {
      fade.setValue(1);
      return;
    }
    Animated.timing(fade, {
      duration: motion.slow,
      easing: motion.easing,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [fade, reduced]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={`Skor risiko ${clamped.toFixed(2)} dari 100`}
      style={{ height, opacity: fade, width: size }}
    >
      <Svg height={height} width={size}>
        <Defs>
          <LinearGradient id="riskGaugeFill" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={gaugeGradient.start} />
            <Stop offset="1" stopColor={gaugeGradient.end} />
          </LinearGradient>
        </Defs>
        <Path
          d={path}
          fill="none"
          stroke={chartColors.track}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        {clamped > 0 ? (
          <Path
            d={path}
            fill="none"
            stroke="url(#riskGaugeFill)"
            strokeDasharray={[length, length]}
            strokeDashoffset={length * (1 - clamped / 100)}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        ) : null}
      </Svg>
      <View style={[styles.center, { top: centerY - 40 }]}>
        <Text style={styles.value}>{clamped.toFixed(2)}</Text>
        <Text style={styles.caption}>dari 100</Text>
      </View>
      <View style={[styles.ticks, { top: centerY + 6, width: size - strokeWidth }]}>
        <Text style={styles.tick}>0</Text>
        <Text style={styles.tick}>100</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  value: {
    ...text.metricHero,
    color: colors.text,
    fontSize: 40,
    lineHeight: 46,
  },
  caption: {
    ...text.captionStrong,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 9,
    position: 'absolute',
  },
  tick: {
    ...text.small,
    color: colors.muted,
  },
});
