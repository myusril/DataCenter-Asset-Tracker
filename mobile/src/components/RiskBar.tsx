import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
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

/** Plain progress bar for a 0–100 risk score; no chart library involved. */
export function RiskBar({ score, level, thickness = 8 }: RiskBarProps) {
  const clamped = Math.min(Math.max(score, 0), 100);

  return (
    <View style={[styles.track, { height: thickness }]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: LEVEL_COLORS[level],
            width: `${clamped}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.pill,
    height: '100%',
  },
});
