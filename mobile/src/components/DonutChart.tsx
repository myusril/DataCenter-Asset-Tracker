import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { chartColors } from '../theme/tokens';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  trackColor?: string;
}

/**
 * Pure SVG donut: arc length is the segment value over the real total, no
 * smoothing or invented data. An empty total renders only the track.
 *
 * Deliberately static: wrapping react-native-svg in an `Animated.View` makes
 * Android composite a visible rectangular layer behind the ring.
 */
export function DonutChart({
  segments,
  size = 148,
  thickness = 16,
  children,
  accessibilityLabel,
  trackColor = chartColors.track,
}: DonutChartProps) {
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  const gap = total > 0 ? Math.min(3, circumference / (segments.length * 4)) : 0;

  let offset = 0;

  return (
    <View
      accessible
      accessibilityLabel={
        accessibilityLabel ??
        segments.map((segment) => `${segment.label} ${segment.value}`).join(', ')
      }
      style={{ height: size, width: size }}
    >
      <Svg height={size} width={size}>
        <G rotation={-90} originX={center} originY={center}>
          <Circle
            cx={center}
            cy={center}
            fill="none"
            r={radius}
            stroke={trackColor}
            strokeWidth={thickness}
          />
          {segments.map((segment) => {
            const value = Math.max(segment.value, 0);
            if (value === 0 || total === 0) {
              return null;
            }
            const length = (value / total) * circumference;
            const dash = Math.max(length - gap, 1);
            const element = (
              <Circle
                cx={center}
                cy={center}
                fill="none"
                key={segment.label}
                r={radius}
                stroke={segment.color}
                strokeDasharray={[dash, circumference - dash]}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                strokeWidth={thickness}
              />
            );
            offset += length;
            return element;
          })}
        </G>
      </Svg>
      <View pointerEvents="none" style={styles.center}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
