import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { gradients, layout, motion } from '../theme/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Loading placeholder. The shimmer is one 240 ms sweep when the block mounts;
 * it is disabled entirely when the OS reduced-motion setting is on.
 */
export function Skeleton({ width = '100%', height = 14, radius: r = 8, style }: SkeletonProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      return;
    }
    Animated.timing(progress, {
      duration: motion.slow,
      easing: motion.easing,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [progress, reduced]);

  return (
    <View style={[styles.block, { borderRadius: r, height, width }, style]}>
      {reduced ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sheen,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-160, 420],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={gradients.skeleton}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Dashboard: hero, status ring, distribution bars. */
export function DashboardSkeleton() {
  return (
    <View accessibilityLabel="Memuat ringkasan" accessibilityRole="progressbar" style={styles.stack}>
      <Skeleton height={188} radius={radius.xl} />
      <SkeletonCard>
        <Skeleton height={16} width="42%" />
        <View style={styles.row}>
          <Skeleton height={124} radius={radius.pill} width={124} />
          <View style={styles.legend}>
            <Skeleton height={12} width="80%" />
            <Skeleton height={12} width="65%" />
            <Skeleton height={12} width="72%" />
          </View>
        </View>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton height={16} width="36%" />
        {[0, 1, 2, 3].map((key) => (
          <Skeleton height={14} key={key} width="100%" />
        ))}
      </SkeletonCard>
    </View>
  );
}

/** Asset list: five card placeholders. */
export function AssetListSkeleton() {
  return (
    <View accessibilityLabel="Memuat aset" accessibilityRole="progressbar" style={styles.stack}>
      {[0, 1, 2, 3, 4].map((key) => (
        <SkeletonCard key={key}>
          <View style={styles.rowBetween}>
            <Skeleton height={16} width="60%" />
            <Skeleton height={22} radius={radius.pill} width={64} />
          </View>
          <Skeleton height={12} width="38%" />
          <View style={styles.rowBetween}>
            <Skeleton height={12} width="52%" />
            <Skeleton height={20} radius={radius.pill} width={70} />
          </View>
        </SkeletonCard>
      ))}
    </View>
  );
}

/** Detail: hero, tab strip, grouped rows. */
export function AssetDetailSkeleton() {
  return (
    <View accessibilityLabel="Memuat detail aset" accessibilityRole="progressbar" style={styles.stack}>
      <Skeleton height={128} radius={radius.xl} />
      <Skeleton height={48} radius={radius.md} />
      <SkeletonCard>
        {[0, 1, 2, 3, 4].map((key) => (
          <View key={key} style={styles.rowBetween}>
            <Skeleton height={12} width="34%" />
            <Skeleton height={12} width="44%" />
          </View>
        ))}
      </SkeletonCard>
    </View>
  );
}

/** Risk screen: gauge, three badges, top-asset rows. */
export function RiskSkeleton() {
  return (
    <View accessibilityLabel="Memuat analisis" accessibilityRole="progressbar" style={styles.stack}>
      <SkeletonCard>
        <Skeleton height={150} radius={radius.lg} />
        <View style={styles.row}>
          <Skeleton height={64} radius={radius.md} width="31%" />
          <Skeleton height={64} radius={radius.md} width="31%" />
          <Skeleton height={64} radius={radius.md} width="31%" />
        </View>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton height={16} width="44%" />
        {[0, 1, 2, 3].map((key) => (
          <View key={key} style={styles.rowBetween}>
            <Skeleton height={14} width="55%" />
            <Skeleton height={14} width={44} />
          </View>
        ))}
      </SkeletonCard>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.mutedSurface,
    overflow: 'hidden',
  },
  sheen: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 160,
  },
  stack: {
    gap: spacing.lg,
    paddingHorizontal: layout.screenPadding,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legend: {
    flex: 1,
    gap: spacing.md,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
