import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchRiskSummary } from '../../api/ai';
import { fetchAssetStatistics } from '../../api/assets';
import { extractErrorMessage } from '../../api/client';
import { BarChart } from '../../components/BarChart';
import { ChartCard } from '../../components/ChartCard';
import { DonutChart } from '../../components/DonutChart';
import { EmptyState } from '../../components/EmptyState';
import { GradientHeader } from '../../components/GradientHeader';
import { DashboardSkeleton } from '../../components/Skeleton';
import { StatTile } from '../../components/StatTile';
import { useCountUp } from '../../hooks/useCountUp';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { chartColors, layout } from '../../theme/tokens';
import { fontFamily, text } from '../../theme/typography';
import type { AssetStatistics, AssetType, RiskLevel, RiskSummary } from '../../types/api';
import {
  ASSET_TYPE_LABELS,
  formatDateTime,
  formatLongDate,
  greeting,
  initialsOf,
  RISK_LABELS,
} from '../../utils/format';

const STATUS_ROWS = [
  { key: 'ACTIVE', label: 'Aktif', color: chartColors.active },
  { key: 'MAINTENANCE', label: 'Maintenance', color: chartColors.maintenance },
  { key: 'INACTIVE', label: 'Nonaktif', color: chartColors.inactive },
] as const;

const RISK_SEGMENTS = [
  { key: 'LOW', label: RISK_LABELS.LOW, color: chartColors.riskLow },
  { key: 'MEDIUM', label: RISK_LABELS.MEDIUM, color: chartColors.riskMedium },
  { key: 'HIGH', label: RISK_LABELS.HIGH, color: chartColors.riskHigh },
] as const;

const TYPE_ORDER = Object.keys(ASSET_TYPE_LABELS) as AssetType[];

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const [stats, setStats] = useState<AssetStatistics | null>(null);
  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const currentRequest = ++requestId.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextStats, nextRisk] = await Promise.all([
        fetchAssetStatistics(),
        fetchRiskSummary(),
      ]);
      if (currentRequest !== requestId.current) {
        return;
      }
      setStats(nextStats);
      setRisk(nextRisk);
    } catch (caught) {
      if (currentRequest === requestId.current) {
        setError(extractErrorMessage(caught));
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const highRiskAsset = risk?.topRiskAssets.find((item) => item.riskLevel === 'HIGH') ?? null;
  const counts = risk?.counts ?? { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const predictedTotal = counts.LOW + counts.MEDIUM + counts.HIGH;
  const total = stats?.total ?? 0;
  const animatedTotal = useCountUp(total);
  const activeCount = stats?.byStatus.ACTIVE ?? 0;
  const maintenanceCount = stats?.byStatus.MAINTENANCE ?? 0;
  const inactiveCount = stats?.byStatus.INACTIVE ?? 0;

  const typeData = stats
    ? TYPE_ORDER.filter((type) => stats.byType[type] > 0)
        .sort((left, right) => stats.byType[right] - stats.byType[left])
        .map((type) => ({ label: ASSET_TYPE_LABELS[type], value: stats.byType[type] }))
    : [];

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <GradientHeader
          eyebrow={formatLongDate()}
          right={
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{initialsOf(user?.fullName ?? '') || 'DC'}</Text>
            </View>
          }
          subtitle="Ringkasan aset data center hari ini."
          title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? 'Pengguna'}`}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroText}>
              <Text style={styles.heroLabel}>Total aset</Text>
              <Text style={styles.heroValue}>{animatedTotal}</Text>
            </View>
            <DonutChart
              accessibilityLabel={`Prediksi aktif ${predictedTotal}: ${counts.HIGH} tinggi, ${counts.MEDIUM} sedang, ${counts.LOW} rendah`}
              segments={RISK_SEGMENTS.map((segment) => ({
                color: segment.color,
                label: segment.label,
                value: counts[segment.key as RiskLevel],
              }))}
              lineCap="butt"
              size={104}
              thickness={11}
              trackColor={predictedTotal > 0 ? 'transparent' : 'rgba(255,255,255,0.22)'}
            >
              <Ionicons color={colors.onPrimary} name="shield-outline" size={22} />
              <Text style={styles.ringLabel}>risiko</Text>
            </DonutChart>
          </View>
          <Text style={styles.heroNote}>
            {risk ? `${risk.assetsWithoutPrediction} aset belum diprediksi` : 'Memuat prediksi...'}
            {risk?.lastPredictedAt ? ` · terakhir ${formatDateTime(risk.lastPredictedAt)}` : ''}
          </Text>
        </GradientHeader>

        <View style={styles.body}>
          {loading && !stats ? <DashboardSkeleton /> : null}

          {error && !stats ? (
            <ChartCard>
              <EmptyState
                action={{ label: 'Coba lagi', onPress: () => void load() }}
                illustration="error"
                message={error}
                title="Gagal memuat ringkasan"
              />
            </ChartCard>
          ) : null}

          {stats && risk ? (
            <>
              <View style={styles.tileRow}>
                <StatTile
                  icon="shield-outline"
                  label="Garansi habis ≤ 30 hari"
                  tone="warning"
                  value={stats.warrantyExpiringSoon}
                />
                <StatTile
                  icon="trending-up-outline"
                  label="Aset baru bulan ini"
                  tone="success"
                  value={stats.addedThisMonth}
                />
              </View>

              <ChartCard
                subtitle="Jumlah aset per status dari server"
                title="Kondisi Aset"
              >
                <View
                  accessible
                  accessibilityLabel={`Total ${total} aset: ${activeCount} aktif, ${maintenanceCount} maintenance, ${inactiveCount} nonaktif`}
                  style={styles.statusBar}
                >
                  {total > 0
                    ? STATUS_ROWS.map((row) => {
                        const value = stats.byStatus[row.key];
                        if (value === 0) {
                          return null;
                        }
                        return (
                          <View
                            key={row.key}
                            style={[
                              styles.statusBarSegment,
                              { backgroundColor: row.color, flex: value },
                            ]}
                          />
                        );
                      })
                    : null}
                </View>

                <View style={styles.legend}>
                  {STATUS_ROWS.map((row) => {
                    const value = stats.byStatus[row.key];
                    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
                    return (
                      <View key={row.key} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: row.color }]} />
                        <Text numberOfLines={1} style={styles.legendLabel}>
                          {row.label}
                        </Text>
                        <Text style={styles.legendValue}>{value}</Text>
                        <Text style={styles.legendPercent}>{percent}%</Text>
                      </View>
                    );
                  })}
                </View>
              </ChartCard>

              <ChartCard
                subtitle="Bar mengikuti jumlah tipe terbanyak"
                title="Sebaran Tipe"
              >
                {typeData.length > 0 ? (
                  <BarChart data={typeData} />
                ) : (
                  <EmptyState
                    compact
                    illustration="assets"
                    message="Statistik tipe akan tampil setelah ada aset tercatat."
                    title="Belum ada aset"
                  />
                )}
              </ChartCard>

              <ChartCard
                subtitle="Mesin heuristik deterministik (aturan, statistik, pola) — bukan model yang dilatih."
                title="Ringkasan Risiko"
              >
                <View style={styles.riskScoreRow}>
                  <Text style={styles.riskScore}>{risk.averageScore.toFixed(2)}</Text>
                  <View style={styles.riskScoreMeta}>
                    <Text style={styles.riskScoreLabel}>skor rata-rata</Text>
                    <Text style={styles.riskScoreLabel}>dari 100</Text>
                  </View>
                  <View style={styles.riskCounts}>
                    {RISK_SEGMENTS.map((segment) => (
                      <View key={segment.key} style={styles.riskCount}>
                        <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                        <Text style={styles.riskCountValue}>{counts[segment.key as RiskLevel]}</Text>
                        <Text style={styles.riskCountLabel}>{segment.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {predictedTotal === 0 ? (
                  <EmptyState
                    compact
                    illustration="prediction"
                    message="Jalankan prediksi dari tab Risiko untuk melihat sebaran tingkat risiko."
                    title="Belum ada prediksi aktif"
                  />
                ) : null}

                {highRiskAsset ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/asset/${highRiskAsset.assetId}`)}
                    style={({ pressed }) => [styles.alertCard, pressed ? styles.pressed : null]}
                  >
                    <View style={styles.alertIcon}>
                      <Ionicons color={colors.dangerInk} name="warning" size={18} />
                    </View>
                    <View style={styles.alertBody}>
                      <Text style={styles.alertTitle}>Aset paling berisiko</Text>
                      <Text numberOfLines={1} style={styles.alertText}>
                        {highRiskAsset.assetCode} · skor {highRiskAsset.riskScore.toFixed(1)}
                      </Text>
                    </View>
                    <Ionicons color={colors.dangerInk} name="chevron-forward" size={18} />
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/(tabs)/ai')}
                  style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.linkLabel}>Lihat analisis risiko lengkap</Text>
                  <Ionicons color={colors.primary} name="arrow-forward" size={16} />
                </Pressable>
              </ChartCard>

              <Text style={styles.sectionTitle}>Akses Cepat</Text>
              <View style={styles.quickGrid}>
                <QuickLink
                  icon="cube-outline"
                  label="Semua Aset"
                  onPress={() => router.push('/(tabs)/assets')}
                  tone={colors.accentSoft}
                />
                <QuickLink
                  icon="construct-outline"
                  label="Maintenance"
                  onPress={() => router.push('/maintenance')}
                  tone={colors.warningSoft}
                />
                <QuickLink
                  icon="wifi-outline"
                  label="Jaringan"
                  onPress={() => router.push('/network')}
                  tone={colors.successSoft}
                />
                <QuickLink
                  icon="person-outline"
                  label="Profil"
                  onPress={() => router.push('/(tabs)/profile')}
                  tone={colors.mutedSurface}
                />
              </View>

              {error ? <Text style={styles.refreshError}>Data terakhir gagal diperbarui: {error}</Text> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickLink, pressed ? styles.pressed : null]}
    >
      <View style={[styles.quickIcon, { backgroundColor: tone }]}>
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <Text numberOfLines={2} style={styles.quickLinkText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  statusScrim: {
    backgroundColor: colors.primary,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
  },
  content: {
    paddingBottom: layout.tabBarClearance,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarLabel: {
    ...text.captionStrong,
    color: colors.onPrimary,
    fontFamily: fontFamily.bold,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroLabel: {
    ...text.captionStrong,
    color: colors.onPrimaryMuted,
  },
  heroValue: {
    ...text.metricHero,
  },
  heroNote: {
    ...text.small,
    color: colors.onPrimaryMuted,
    marginTop: spacing.md,
  },
  ringLabel: {
    ...text.small,
    color: colors.onPrimaryMuted,
  },
  body: {
    gap: layout.sectionGap,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusBar: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 3,
    height: 18,
    overflow: 'hidden',
  },
  statusBarSegment: {
    borderRadius: 4,
    height: '100%',
  },
  legend: {
    gap: spacing.sm + 2,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  legendDot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  legendLabel: {
    ...text.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  legendValue: {
    ...text.captionStrong,
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'right',
  },
  legendPercent: {
    ...text.small,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  },
  riskScoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  riskScore: {
    ...text.metricLarge,
  },
  riskScoreMeta: {
    flexShrink: 0,
  },
  riskScoreLabel: {
    ...text.small,
    color: colors.muted,
  },
  riskCounts: {
    flex: 1,
    gap: spacing.xs,
  },
  riskCount: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  riskCountValue: {
    ...text.captionStrong,
    fontVariant: ['tabular-nums'],
    minWidth: 18,
    textAlign: 'right',
  },
  riskCountLabel: {
    ...text.small,
    color: colors.muted,
    minWidth: 44,
  },
  alertCard: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  alertIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    ...text.captionStrong,
    color: colors.dangerInk,
  },
  alertText: {
    ...text.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  linkRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingTop: spacing.md,
  },
  linkLabel: {
    ...text.captionStrong,
    color: colors.primary,
  },
  sectionTitle: {
    ...text.label,
    marginBottom: -spacing.xs,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickLink: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
    width: '47.8%',
  },
  quickIcon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  quickLinkText: {
    ...text.captionStrong,
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  refreshError: {
    ...text.caption,
    color: colors.dangerInk,
  },
});
