import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { motion } from '../theme/tokens';
import { text } from '../theme/typography';

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  color?: string;
  unitLabel?: (value: number) => string;
}

/**
 * Horizontal distribution bars. Widths are value / max(value), so a bar chart
 * with a single non-zero row is honest instead of looking "full of fake data".
 */
export function BarChart({ data, color = colors.primary, unitLabel }: BarChartProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const max = Math.max(...data.map((item) => item.value), 0);
  const signature = data.map((item) => `${item.label}:${item.value}`).join('|');

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      duration: motion.base + 40,
      easing: motion.easing,
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [progress, reduced, signature]);

  return (
    <View style={styles.container}>
      {data.map((item) => {
        const share = max > 0 ? item.value / max : 0;
        return (
          <View
            accessibilityLabel={`${item.label} ${item.value}`}
            accessible
            key={item.label}
            style={styles.row}
          >
            <Text numberOfLines={1} style={styles.label}>
              {item.label}
            </Text>
            <View
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width > 0 && Math.abs(width - trackWidth) > 0.5) {
                  setTrackWidth(width);
                }
              }}
              style={styles.track}
            >
              <Animated.View
                style={[
                  styles.fill,
                  {
                    backgroundColor: item.color ?? color,
                    width:
                      trackWidth === 0
                        ? 0
                        : progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.max(share * trackWidth, item.value > 0 ? 6 : 0)],
                          }),
                  },
                ]}
              />
            </View>
            <Text style={styles.value}>{unitLabel ? unitLabel(item.value) : item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm + 2,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 24,
  },
  label: {
    ...text.caption,
    flexShrink: 1,
    width: 82,
  },
  track: {
    backgroundColor: '#EEF1F7',
    borderRadius: radius.pill,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  value: {
    ...text.captionStrong,
    fontVariant: ['tabular-nums'],
    minWidth: 26,
    textAlign: 'right',
  },
});
