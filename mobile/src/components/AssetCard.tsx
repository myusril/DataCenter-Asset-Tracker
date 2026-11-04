import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { elevation } from '../theme/tokens';
import { text } from '../theme/typography';
import type { Asset } from '../types/api';
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS, CONNECTION_LABELS } from '../utils/format';
import { ASSET_STATUS_TONES, CONNECTION_TONES } from '../utils/pills';
import { StatusPill } from './StatusPill';

interface AssetCardProps {
  asset: Asset;
  onPress: () => void;
}

const RAIL_COLORS = {
  ACTIVE: colors.success,
  MAINTENANCE: colors.warning,
  INACTIVE: colors.textSecondary,
} as const;

export function AssetCard({ asset, onPress }: AssetCardProps) {
  const location = asset.location;
  const locationText = location
    ? [location.dataCenter, location.rack ? `Rack ${location.rack}` : null, location.rackSlot]
        .filter(Boolean)
        .join(' · ')
    : 'Lokasi belum diisi';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.rail, { backgroundColor: RAIL_COLORS[asset.status] }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={2} style={styles.name}>
              {asset.assetName}
            </Text>
            <Text numberOfLines={1} style={styles.code}>
              {asset.assetCode} · {ASSET_TYPE_LABELS[asset.assetType]}
            </Text>
          </View>
          <StatusPill label={ASSET_STATUS_LABELS[asset.status]} tone={ASSET_STATUS_TONES[asset.status]} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons color={colors.muted} name="location-outline" size={14} />
            <Text numberOfLines={2} style={styles.metaText}>
              {locationText}
            </Text>
          </View>
          {asset.network ? (
            <StatusPill
              label={CONNECTION_LABELS[asset.network.connectionStatus]}
              tone={CONNECTION_TONES[asset.network.connectionStatus]}
            />
          ) : null}
          <View style={styles.chevron}>
            <Ionicons color={colors.muted} name="chevron-forward" size={16} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevation.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 96,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  rail: {
    borderBottomLeftRadius: radius.lg,
    borderTopLeftRadius: radius.lg,
    width: 4,
  },
  body: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingLeft: spacing.lg - 4,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  name: {
    ...text.bodyStrong,
    fontSize: 15,
    lineHeight: 21,
  },
  code: {
    ...text.small,
    color: colors.muted,
    marginTop: 2,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
  },
  metaText: {
    ...text.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
});
