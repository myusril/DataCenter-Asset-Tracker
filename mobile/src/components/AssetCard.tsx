import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';
import type { Asset } from '../types/api';
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS, CONNECTION_LABELS } from '../utils/format';
import { ASSET_STATUS_TONES, CONNECTION_TONES } from '../utils/pills';
import { StatusPill } from './StatusPill';

interface AssetCardProps {
  asset: Asset;
  onPress: () => void;
}

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
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.name}>
            {asset.assetName}
          </Text>
          <Text style={styles.code}>
            {asset.assetCode} · {ASSET_TYPE_LABELS[asset.assetType]}
          </Text>
        </View>
        <StatusPill label={ASSET_STATUS_LABELS[asset.status]} tone={ASSET_STATUS_TONES[asset.status]} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons color={colors.muted} name="location-outline" size={14} />
          <Text numberOfLines={1} style={styles.metaText}>
            {locationText}
          </Text>
        </View>

        {asset.network ? (
          <View style={styles.metaItem}>
            <StatusPill
              label={CONNECTION_LABELS[asset.network.connectionStatus]}
              tone={CONNECTION_TONES[asset.network.connectionStatus]}
            />
          </View>
        ) : null}

        <Ionicons color={colors.muted} name="chevron-forward" size={16} style={styles.chevron} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
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
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  code: {
    color: colors.muted,
    fontSize: typography.small,
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
    gap: 4,
    maxWidth: '58%',
  },
  metaText: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontSize: typography.small,
  },
  chevron: {
    marginLeft: 'auto',
  },
});
