import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchRiskExplanation, predictAssetRisk } from '../../../api/ai';
import { fetchAssetDetail } from '../../../api/assets';
import { extractErrorMessage } from '../../../api/client';
import { fetchAssetMaintenance } from '../../../api/maintenance';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { Loading } from '../../../components/Loading';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { StatusPill } from '../../../components/StatusPill';
import { useIsAdmin } from '../../../hooks/useIsAdmin';
import { colors } from '../../../theme/colors';
import { radius, spacing, typography } from '../../../theme/spacing';
import type {
  AssetDetail,
  MaintenanceRecord,
  RiskExplanation,
  RiskLevel,
} from '../../../types/api';
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  CONNECTION_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  MAINTENANCE_TYPE_LABELS,
  RISK_LABELS,
} from '../../../utils/format';
import {
  ASSET_STATUS_TONES,
  CONNECTION_TONES,
  MAINTENANCE_TYPE_TONES,
  RISK_TONES,
} from '../../../utils/pills';

const TABS = [
  { key: 'general', label: 'Umum' },
  { key: 'network', label: 'Jaringan' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'ai', label: 'AI' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SCORE_COLORS: Record<RiskLevel, string> = {
  LOW: colors.success,
  MEDIUM: colors.warning,
  HIGH: colors.danger,
};

const FACTOR_LABELS: Record<string, string> = {
  frequency: 'Frekuensi maintenance',
  incidents: 'Insiden perbaikan',
  age: 'Usia aset',
  status: 'Status aset',
  network: 'Kondisi jaringan',
  trend: 'Tren maintenance',
  zScore: 'Deviasi interval',
  interval: 'Interval maintenance',
  peer: 'Perbandingan peer',
  downtimeOffline: 'Jaringan offline',
  downtimeRepair: 'Perbaikan berulang',
  repairRatio: 'Rasio perbaikan',
  daysSince: 'Jarak maintenance terakhir',
};

export default function AssetDetailScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { id } = useLocalSearchParams<{ id: string }>();
  const assetId = Number(id);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<RiskExplanation | null>(null);
  const [tab, setTab] = useState<TabKey>('general');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictNotice, setPredictNotice] = useState<string | null>(null);
  const requestId = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!Number.isFinite(assetId) || assetId <= 0) {
        setError('Aset tidak ditemukan.');
        setLoading(false);
        return;
      }

      const currentRequest = ++requestId.current;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setMaintenanceError(null);

      const [detailResult, maintenanceResult, explanationResult] = await Promise.allSettled([
        fetchAssetDetail(assetId),
        fetchAssetMaintenance(assetId),
        fetchRiskExplanation(assetId),
      ]);

      if (currentRequest !== requestId.current) {
        return;
      }

      if (detailResult.status === 'rejected') {
        setError(extractErrorMessage(detailResult.reason));
      } else {
        setAsset(detailResult.value);
      }

      if (maintenanceResult.status === 'fulfilled') {
        setMaintenance(maintenanceResult.value);
      } else {
        setMaintenance([]);
        setMaintenanceError(extractErrorMessage(maintenanceResult.reason));
      }

      setExplanation(
        explanationResult.status === 'fulfilled' ? explanationResult.value : null,
      );
      setLoading(false);
      setRefreshing(false);
    },
    [assetId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function selectTab(nextTab: TabKey) {
    setTab(nextTab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/assets');
  }

  async function handlePredict() {
    if (predicting) {
      return;
    }
    setPredicting(true);
    setPredictNotice(null);
    try {
      const result = await predictAssetRisk(assetId);
      setPredictNotice(
        `Prediksi diperbarui: ${result.riskScore.toFixed(1)} ${RISK_LABELS[result.riskLevel]}` +
          `${result.alertsCreated > 0 ? ` · ${result.alertsCreated} alert dibuat` : ''}.`,
      );
      await load(true);
    } catch (caught) {
      setPredictNotice(`Gagal memperbarui prediksi: ${extractErrorMessage(caught)}`);
    } finally {
      setPredicting(false);
    }
  }

  if (loading && !asset) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={goBack} title="Detail Aset" />
        <Loading message="Memuat detail aset..." />
      </SafeAreaView>
    );
  }

  if (!asset) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={goBack} title="Detail Aset" />
        <View style={styles.listState}>
          <Card title="Gagal memuat detail aset">
            <Text style={styles.bodyText}>{error ?? 'Aset tidak ditemukan.'}</Text>
            <Button
              label="Coba lagi"
              onPress={() => void load()}
              style={styles.retry}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const prediction = asset.latestPrediction;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={goBack} title="Detail Aset" />
      <ScrollView
        contentContainerStyle={styles.content}
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
      >
        {error ? (
          <View style={styles.refreshErrorBox}>
            <Text style={styles.refreshErrorText}>Gagal memperbarui data: {error}</Text>
          </View>
        ) : null}

        <Card>
          <View style={styles.heroTop}>
            <Text style={styles.heroType}>{ASSET_TYPE_LABELS[asset.assetType]}</Text>
            <StatusPill
              label={ASSET_STATUS_LABELS[asset.status]}
              tone={ASSET_STATUS_TONES[asset.status]}
            />
          </View>
          <Text style={styles.heroName}>{asset.assetName}</Text>
          <Text style={styles.heroCode}>{asset.assetCode}</Text>

          <View style={styles.divider} />

          <InfoRow label="Merek" value={asset.brand ?? '-'} />
          <InfoRow label="Model" value={asset.model ?? '-'} />
          <InfoRow label="Serial number" value={asset.serialNumber ?? '-'} />
          <InfoRow label="Garansi sampai" value={formatDate(asset.warrantyEnd)} />
          <InfoRow
            label="Lokasi"
            value={
              asset.location
                ? `${asset.location.dataCenter} · ${
                    asset.location.rack ? `Rack ${asset.location.rack}` : 'Tanpa rack'
                  }${asset.location.rackSlot ? ` · ${asset.location.rackSlot}` : ''}`
                : 'Belum diisi'
            }
          />
        </Card>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              key={item.key}
              onPress={() => selectTab(item.key)}
              style={[styles.tab, tab === item.key ? styles.tabActive : null]}
            >
              <Text style={[styles.tabLabel, tab === item.key ? styles.tabLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'general' ? (
          <>
            <Card title="Spesifikasi">
              <InfoRow label="Tipe aset" value={ASSET_TYPE_LABELS[asset.assetType]} />
              <InfoRow label="Merek" value={asset.brand ?? '-'} />
              <InfoRow label="Model" value={asset.model ?? '-'} />
              <InfoRow label="Serial number" value={asset.serialNumber ?? '-'} />
              <InfoRow label="Tanggal pembelian" value={formatDate(asset.purchaseDate)} />
              <InfoRow label="Garansi sampai" value={formatDate(asset.warrantyEnd)} />
              <InfoRow label="Dibuat oleh" value={asset.creator?.fullName ?? '-'} />
              <InfoRow label="Riwayat maintenance" value={`${asset.maintenanceCount} catatan`} />
            </Card>

            <Card title="Lokasi">
              {asset.location ? (
                <>
                  <InfoRow label="Data center" value={asset.location.dataCenter} />
                  <InfoRow label="Rack" value={asset.location.rack ?? '-'} />
                  <InfoRow label="Slot" value={asset.location.rackSlot ?? '-'} />
                  <InfoRow label="Lantai" value={asset.location.floor ?? '-'} />
                  <InfoRow label="Ruangan" value={asset.location.room ?? '-'} />
                  <InfoRow label="Ditempatkan sejak" value={formatDateTime(asset.location.movedAt)} />
                </>
              ) : (
                <Text style={styles.bodyText}>Lokasi aset belum diisi.</Text>
              )}
            </Card>

            <Card title="Deskripsi">
              <Text style={styles.bodyText}>
                {asset.description ?? 'Belum ada deskripsi untuk aset ini.'}
              </Text>
            </Card>
          </>
        ) : null}

        {tab === 'network' ? (
          <Card title="Informasi jaringan">
            {asset.network ? (
              <>
                <InfoRow label="Hostname" value={asset.network.hostname ?? '-'} />
                <InfoRow label="Alamat IP" value={asset.network.ipAddress ?? '-'} />
                <InfoRow label="Subnet mask" value={asset.network.subnetMask ?? '-'} />
                <InfoRow label="Gateway" value={asset.network.gateway ?? '-'} />
                <InfoRow label="MAC address" value={asset.network.macAddress ?? '-'} />
                <InfoRow label="Terakhir dicek" value={formatDateTime(asset.network.lastChecked)} />
                <InfoRow label="Catatan" value={asset.network.notes ?? '-'} />
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status koneksi</Text>
                  <StatusPill
                    label={CONNECTION_LABELS[asset.network.connectionStatus]}
                    tone={CONNECTION_TONES[asset.network.connectionStatus]}
                  />
                </View>
              </>
            ) : (
              <EmptyState
                icon="wifi-outline"
                message="Data hostname, IP, dan status koneksi belum diisi untuk aset ini."
                title="Belum ada informasi jaringan"
              />
            )}
          </Card>
        ) : null}

        {tab === 'maintenance' ? (
          <View style={styles.sectionList}>
            {maintenanceError ? (
              <Card title="Gagal memuat riwayat">
                <Text style={styles.bodyText}>{maintenanceError}</Text>
                <Button
                  label="Coba lagi"
                  onPress={() => void load()}
                  style={styles.retry}
                />
              </Card>
            ) : maintenance.length === 0 ? (
              <Card>
                <EmptyState
                  icon="construct-outline"
                  message="Catatan perawatan aset ini akan tampil di sini."
                  title="Belum ada riwayat maintenance"
                />
              </Card>
            ) : (
              maintenance.map((record) => (
                <Pressable
                  accessibilityRole="button"
                  key={record.id}
                  onPress={() => router.push(`/maintenance/${record.id}`)}
                  style={({ pressed }) => [pressed ? styles.pressedCard : null]}
                >
                  <Card>
                    <View style={styles.recordHeader}>
                      <StatusPill
                        label={MAINTENANCE_TYPE_LABELS[record.maintenanceType]}
                        tone={MAINTENANCE_TYPE_TONES[record.maintenanceType]}
                      />
                      <Text style={styles.recordDate}>{formatDate(record.maintenanceDate)}</Text>
                    </View>
                    <InfoRow
                      label="Teknisi"
                      value={record.technician?.fullName ?? 'Tidak dicatat'}
                    />
                    <InfoRow label="Hasil" value={record.result ?? '-'} />
                    {record.description ? (
                      <Text style={styles.recordDescription}>{record.description}</Text>
                    ) : null}
                    <View style={styles.recordFooter}>
                      <Text style={styles.recordMeta}>Biaya: {formatCurrency(record.cost)}</Text>
                      {record.nextSchedule ? (
                        <Text style={styles.recordMeta}>
                          Jadwal berikutnya: {formatDate(record.nextSchedule)}
                        </Text>
                      ) : null}
                      <View style={styles.recordLinkRow}>
                        <Text style={styles.recordLink}>Lihat detail catatan</Text>
                        <Ionicons color={colors.accent} name="chevron-forward" size={14} />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {tab === 'ai' ? (
          prediction ? (
            <View style={styles.sectionList}>
              <Card title="Prediksi Risiko Aktif">
                {predictNotice ? (
                  <View style={styles.predictNotice}>
                    <Text style={styles.predictNoticeText}>{predictNotice}</Text>
                  </View>
                ) : null}
                <View style={styles.scoreRow}>
                  <Text style={[styles.score, { color: SCORE_COLORS[prediction.riskLevel] }]}>
                    {prediction.riskScore.toFixed(1)}
                  </Text>
                  <View style={styles.scoreMeta}>
                    <Text style={styles.scoreMax}>dari 100</Text>
                    <StatusPill
                      label={RISK_LABELS[prediction.riskLevel]}
                      tone={RISK_TONES[prediction.riskLevel]}
                    />
                  </View>
                </View>

                <View style={styles.scoreTrack}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        backgroundColor: SCORE_COLORS[prediction.riskLevel],
                        width: `${Math.min(Math.max(prediction.riskScore, 0), 100)}%`,
                      },
                    ]}
                  />
                </View>

                <InfoRow
                  label="Confidence"
                  value={prediction.confidence !== null ? `${prediction.confidence}%` : '-'}
                />
                <InfoRow
                  label="Perkiraan kegagalan"
                  value={
                    prediction.predictedFailureDays !== null
                      ? `${prediction.predictedFailureDays} hari`
                      : '-'
                  }
                />
                <InfoRow label="Versi model" value={prediction.modelVersion} />
                <InfoRow label="Diprediksi pada" value={formatDateTime(prediction.predictedAt)} />
                <Text style={styles.disclaimer}>
                  Skor dihitung oleh mesin heuristik berbasis aturan dan statistik, bukan model
                  machine learning yang dilatih.
                </Text>

                {isAdmin ? (
                  <Button
                    label="Prediksi ulang"
                    loading={predicting}
                    onPress={handlePredict}
                    style={styles.predictButton}
                    variant="secondary"
                  />
                ) : null}
              </Card>

              <Card
                subtitle={
                  explanation
                    ? 'Dihitung ulang saat halaman dibuka dan tidak mengubah prediksi tersimpan.'
                    : undefined
                }
                title="Rincian Perhitungan"
              >
                {explanation ? (
                  <>
                    <InfoRow
                      label="Lapisan 1 — basis berbobot"
                      value={explanation.layerBreakdown.layer1.baseScore.toFixed(2)}
                    />
                    <InfoRow
                      label="Lapisan 2 — penyesuaian statistik"
                      value={formatAdjustment(explanation.layerBreakdown.layer2.total)}
                    />
                    <InfoRow
                      label="Lapisan 3 — pencocokan pola"
                      value={formatAdjustment(explanation.layerBreakdown.layer3.total)}
                    />
                    <InfoRow
                      label="Total"
                      value={explanation.layerBreakdown.final.toFixed(2)}
                    />
                  </>
                ) : (
                  <Text style={styles.bodyText}>
                    Rincian perhitungan tidak tersedia saat ini.
                  </Text>
                )}
              </Card>

              <Card title="Faktor Utama">
                {(prediction.topFactors ?? []).length === 0 ? (
                  <Text style={styles.bodyText}>Tidak ada faktor yang dicatat.</Text>
                ) : (
                  (prediction.topFactors ?? []).map((factor) => (
                    <View key={factor.name} style={styles.factorRow}>
                      <View style={styles.factorHeader}>
                        <Text style={styles.factorName}>
                          {FACTOR_LABELS[factor.name] ?? factor.name}
                        </Text>
                        <Text style={styles.factorImpact}>
                          {formatAdjustment(factor.impact)}
                        </Text>
                      </View>
                      <Text style={styles.factorDescription}>{factor.description}</Text>
                    </View>
                  ))
                )}
              </Card>

              <Card title="Rekomendasi">
                <Text style={styles.bodyText}>
                  {prediction.recommendation ?? 'Belum ada rekomendasi.'}
                </Text>
              </Card>
            </View>
          ) : (
            <Card>
              <EmptyState
                icon="sparkles-outline"
                message="Prediksi risiko akan tampil di sini setelah administrator menjalankan analisis."
                title="Belum ada prediksi"
              />
              {isAdmin ? (
                <>
                  {predictNotice ? (
                    <Text style={styles.predictNoticeText}>{predictNotice}</Text>
                  ) : null}
                  <Button
                    label="Prediksi sekarang"
                    loading={predicting}
                    onPress={handlePredict}
                    style={styles.predictButton}
                  />
                </>
              ) : null}
            </Card>
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatAdjustment(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  screenTitle: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroType: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  heroName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  heroCode: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: 2,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.md,
  },
  tabs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.accentSoft,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.caption,
  },
  infoValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.caption,
    fontWeight: '500',
    textAlign: 'right',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 21,
  },
  sectionList: {
    gap: spacing.md,
  },
  recordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  recordDate: {
    color: colors.muted,
    fontSize: typography.small,
  },
  recordDescription: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  recordFooter: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 2,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  recordMeta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  scoreRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  score: {
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 46,
  },
  scoreMeta: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  scoreMax: {
    color: colors.muted,
    fontSize: typography.small,
  },
  scoreTrack: {
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.pill,
    height: 8,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  scoreFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  disclaimer: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  factorRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factorName: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  factorImpact: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
  },
  factorDescription: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 2,
  },
  listState: {
    padding: spacing.lg,
  },
  retry: {
    marginTop: spacing.lg,
  },
  refreshErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  refreshErrorText: {
    color: colors.danger,
    fontSize: typography.small,
    lineHeight: 18,
  },
  pressedCard: {
    opacity: 0.85,
  },
  recordLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginTop: spacing.xs,
  },
  recordLink: {
    color: colors.accent,
    fontSize: typography.small,
    fontWeight: '600',
  },
  predictNotice: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  predictNoticeText: {
    color: colors.accent,
    fontSize: typography.small,
    lineHeight: 18,
  },
  predictButton: {
    marginTop: spacing.md,
  },
});
