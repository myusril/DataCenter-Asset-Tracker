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
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchRiskSummary } from '../../api/ai';
import { fetchAssetStatistics } from '../../api/assets';
import { extractErrorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { StatusPill } from '../../components/StatusPill';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import type { AssetStatistics, RiskSummary } from '../../types/api';
import { formatDateTime, greeting, RISK_LABELS } from '../../utils/format';
import { RISK_TONES } from '../../utils/pills';

const STAT_CARDS = [
  { key: 'total', label: 'Total Aset', icon: 'layers-outline', color: colors.accent },
  { key: 'active', label: 'Aktif', icon: 'checkmark-circle-outline', color: colors.success },
  { key: 'maintenance', label: 'Maintenance', icon: 'construct-outline', color: colors.warning },
  { key: 'inactive', label: 'Nonaktif', icon: 'pause-circle-outline', color: colors.muted },
] as const;

export default function DashboardScreen() {
  const router = useRouter();
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
  const values: Record<(typeof STAT_CARDS)[number]['key'], number> = {
    total: stats?.total ?? 0,
    active: stats?.byStatus.ACTIVE ?? 0,
    maintenance: stats?.byStatus.MAINTENANCE ?? 0,
    inactive: stats?.byStatus.INACTIVE ?? 0,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {greeting()}, {user?.fullName.split(' ')[0] ?? 'Pengguna'}
          </Text>
          <Text style={styles.subtitle}>Ringkasan aset data center hari ini.</Text>
        </View>

        {loading && !stats ? <Loading message="Memuat ringkasan..." /> : null}

        {error && !stats ? (
          <Card title="Gagal memuat data">
            <Text style={styles.errorText}>{error}</Text>
            <Button
              label="Coba lagi"
              onPress={() => void load()}
              style={styles.retry}
            />
          </Card>
        ) : null}

        {stats && risk ? (
          <>
            <Text style={styles.sectionTitle}>Statistik Aset</Text>
            <View style={styles.grid}>
              {STAT_CARDS.map((item) => (
                <View key={item.key} style={styles.statCard}>
                  <View style={styles.statIcon}>
                    <Ionicons color={item.color} name={item.icon} size={18} />
                  </View>
                  <Text style={styles.statValue}>{values[item.key]}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Ringkasan Risiko AI</Text>
            <Card
              subtitle="Prediksi aktif dari mesin heuristik, bukan model yang dilatih."
              title="Sebaran Level Risiko"
            >
              <View style={styles.riskStrip}>
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((level) => (
                  <View key={level} style={styles.riskItem}>
                    <StatusPill label={RISK_LABELS[level]} tone={RISK_TONES[level]} />
                    <Text style={styles.riskCount}>{counts[level]}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.riskMeta}>
                <Text style={styles.riskMetaText}>
                  Skor rata-rata {risk.averageScore.toFixed(2)}
                </Text>
                <Text style={styles.riskMetaText}>
                  {risk.assetsWithoutPrediction} aset belum diprediksi
                </Text>
              </View>

              {highRiskAsset ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/asset/${highRiskAsset.assetId}`)}
                  style={({ pressed }) => [
                    styles.alertCard,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.alertIcon}>
                    <Ionicons color={colors.danger} name="warning-outline" size={20} />
                  </View>
                  <View style={styles.alertBody}>
                    <Text style={styles.alertTitle}>
                      {counts.HIGH} Aset Berisiko Tinggi
                    </Text>
                    <Text style={styles.alertText}>
                      {highRiskAsset.assetCode} · skor {highRiskAsset.riskScore.toFixed(1)}
                    </Text>
                  </View>
                  <Ionicons color={colors.muted} name="chevron-forward" size={18} />
                </Pressable>
              ) : null}

              <Text style={styles.lastPrediction}>
                Prediksi terakhir: {formatDateTime(risk.lastPredictedAt)}
              </Text>
            </Card>

            <Text style={styles.sectionTitle}>Akses Cepat</Text>
            <View style={styles.quickLinks}>
              <QuickLink
                icon="cube-outline"
                label="Semua Aset"
                onPress={() => router.push('/(tabs)/assets')}
              />
              <QuickLink
                icon="construct-outline"
                label="Maintenance"
                onPress={() => router.push('/maintenance')}
              />
              <QuickLink
                icon="wifi-outline"
                label="Jaringan"
                onPress={() => router.push('/network')}
              />
              <QuickLink
                icon="person-outline"
                label="Profil Saya"
                onPress={() => router.push('/(tabs)/profile')}
              />
            </View>

            {error ? (
              <Text style={styles.refreshError}>
                Data terakhir gagal diperbarui: {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickLink, pressed ? styles.pressed : null]}
    >
      <Ionicons color={colors.accent} name={icon} size={20} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  greeting: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    width: '48%',
  },
  statIcon: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    height: 30,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 30,
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 2,
  },
  riskStrip: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  riskItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  riskCount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  riskMeta: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  riskMetaText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  alertCard: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
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
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  alertText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: 2,
  },
  lastPrediction: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: spacing.md,
  },
  quickLinks: {
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
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    width: '48%',
  },
  quickLinkText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  retry: {
    marginTop: spacing.lg,
  },
  refreshError: {
    color: colors.danger,
    fontSize: typography.small,
    marginTop: spacing.md,
  },
});
