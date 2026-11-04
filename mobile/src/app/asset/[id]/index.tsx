import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchRiskExplanation, predictAssetRisk } from '../../../api/ai';
import { deleteAsset, describeAssetError, fetchAssetDetail } from '../../../api/assets';
import { extractErrorMessage } from '../../../api/client';
import { fetchAssetMaintenance } from '../../../api/maintenance';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ChartCard } from '../../../components/ChartCard';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { DataList, DataRow } from '../../../components/DataList';
import { EmptyState } from '../../../components/EmptyState';
import { RiskGauge } from '../../../components/RiskGauge';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { AssetDetailSkeleton } from '../../../components/Skeleton';
import { StatusPill } from '../../../components/StatusPill';
import { Toast } from '../../../components/Toast';
import { useIsAdmin } from '../../../hooks/useIsAdmin';
import { useNotificationStore } from '../../../store/notifications';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { layout, STATUS_GRADIENTS } from '../../../theme/tokens';
import { text } from '../../../theme/typography';
import type {
  AssetDetail,
  MaintenanceRecord,
  RiskExplanation,
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
  { key: 'ai', label: 'Risiko' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const refreshUnread = useNotificationStore((state) => state.refreshUnread);
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const requestId = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [scrolled, setScrolled] = useState(false);

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

      setExplanation(explanationResult.status === 'fulfilled' ? explanationResult.value : null);
      setLoading(false);
      setRefreshing(false);
    },
    [assetId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!predictNotice) {
      return;
    }
    const timer = setTimeout(() => setPredictNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [predictNotice]);

  function selectTab(nextTab: TabKey) {
    setTab(nextTab);
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/assets');
  }

  async function handleDelete() {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAsset(assetId);
      setConfirmingDelete(false);
      router.replace('/(tabs)/assets');
    } catch (caught) {
      setDeleteError(describeAssetError(caught));
    } finally {
      setDeleting(false);
    }
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
      await refreshUnread();
    } catch (caught) {
      setPredictNotice(`Gagal memperbarui prediksi: ${extractErrorMessage(caught)}`);
    } finally {
      setPredicting(false);
    }
  }

  const barOpacity = scrollY.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, 100],
    outputRange: [0, 1],
  });
  const floatingOpacity = scrollY.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, 60],
    outputRange: [1, 0],
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = event.nativeEvent.contentOffset.y > 72;
        setScrolled((previous) => (previous === next ? previous : next));
      },
    },
  );

  if (loading && !asset) {
    return (
      <SafeAreaView edges={[]} style={styles.safe}>
        <StatusBar style="dark" />
        <CompactHeader
          insets={insets.top}
          onBack={goBack}
          right={undefined}
          title="Detail Aset"
        />
        <View style={styles.skeletonWrap}>
          <AssetDetailSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (!asset) {
    return (
      <SafeAreaView edges={[]} style={styles.safe}>
        <StatusBar style="dark" />
        <CompactHeader insets={insets.top} onBack={goBack} right={undefined} title="Detail Aset" />
        <View style={styles.stateWrap}>
          <Card>
            <EmptyState
              action={{ label: 'Coba lagi', onPress: () => void load() }}
              illustration="error"
              message={error ?? 'Aset tidak ditemukan.'}
              title="Gagal memuat detail aset"
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const prediction = asset.latestPrediction;
  const gradient = STATUS_GRADIENTS[asset.status];
  const maxImpact = Math.max(
    ...(prediction?.topFactors ?? []).map((factor) => Math.abs(factor.impact)),
    0,
  );

  const headerActions = (
    <View style={styles.headerActions}>
      <Pressable
        accessibilityLabel="Kembali"
        accessibilityRole="button"
        hitSlop={6}
        onPress={goBack}
      >
        <View style={styles.floatingButton}>
          <Ionicons color={colors.onPrimary} name="arrow-back" size={20} />
        </View>
      </Pressable>
      {isAdmin ? (
        <Pressable
          accessibilityLabel="Ubah aset"
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => router.push(`/asset/${assetId}/edit`)}
        >
          <View style={styles.floatingButton}>
            <Ionicons color={colors.onPrimary} name="create-outline" size={19} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style={scrolled ? 'dark' : 'light'} />
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.compactBar,
          {
            opacity: barOpacity,
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.compactBarInner}>
          <Pressable
            accessibilityLabel="Kembali"
            accessibilityRole="button"
            hitSlop={6}
            onPress={goBack}
            style={styles.compactButton}
          >
            <Ionicons color={colors.text} name="arrow-back" size={20} />
          </Pressable>
          <Text numberOfLines={1} style={styles.compactTitle}>
            {asset.assetName}
          </Text>
          {isAdmin ? (
            <Pressable
              accessibilityLabel="Ubah aset"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => router.push(`/asset/${assetId}/edit`)}
              style={styles.compactButton}
            >
              <Ionicons color={colors.text} name="create-outline" size={19} />
            </Pressable>
          ) : (
            <View style={styles.compactButton} />
          )}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.floatingActions, { opacity: floatingOpacity, top: insets.top + spacing.sm }]}
      >
        {headerActions}
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load(true)}
            progressViewOffset={insets.top + 56}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradient}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.hero, { paddingTop: insets.top + 64 }]}
        >
          <View pointerEvents="none" style={styles.heroBlob} />
          <View style={styles.heroTopRow}>
            <Text style={styles.heroType}>{ASSET_TYPE_LABELS[asset.assetType]}</Text>
            <StatusPill
              label={ASSET_STATUS_LABELS[asset.status]}
              tone={ASSET_STATUS_TONES[asset.status]}
            />
          </View>
          <Text style={styles.heroName}>{asset.assetName}</Text>
          <Text style={styles.heroCode}>{asset.assetCode}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {error ? (
            <View style={styles.refreshErrorBox}>
              <Ionicons color={colors.dangerInk} name="alert-circle" size={16} />
              <Text style={styles.refreshErrorText}>Gagal memperbarui data: {error}</Text>
            </View>
          ) : null}

          <SegmentedTabs
            active={tab}
            accessibilityLabel="Bagian detail aset"
            items={TABS}
            onChange={selectTab}
          />

          {tab === 'general' ? (
            <>
              <ChartCard title="Spesifikasi">
                <DataList>
                  <DataRow label="Merek" value={asset.brand ?? '-'} />
                  <DataRow label="Model" value={asset.model ?? '-'} />
                  <DataRow label="Serial number" value={asset.serialNumber ?? '-'} />
                  <DataRow label="Tanggal pembelian" value={formatDate(asset.purchaseDate)} />
                  <DataRow label="Garansi sampai" value={formatDate(asset.warrantyEnd)} />
                  <DataRow label="Dibuat oleh" value={asset.creator?.fullName ?? '-'} />
                  <DataRow label="Riwayat maintenance" value={`${asset.maintenanceCount} catatan`} />
                </DataList>
              </ChartCard>

              <ChartCard title="Lokasi">
                {asset.location ? (
                  <DataList>
                    <DataRow label="Data center" value={asset.location.dataCenter} />
                    <DataRow label="Rack" value={asset.location.rack ?? '-'} />
                    <DataRow label="Slot" value={asset.location.rackSlot ?? '-'} />
                    <DataRow label="Lantai" value={asset.location.floor ?? '-'} />
                    <DataRow label="Ruangan" value={asset.location.room ?? '-'} />
                    <DataRow
                      label="Ditempatkan sejak"
                      value={formatDateTime(asset.location.movedAt)}
                    />
                  </DataList>
                ) : (
                  <EmptyState
                    compact
                    illustration="assets"
                    message="Isi lokasi dari formulir ubah aset bila perangkat sudah ditempatkan."
                    title="Lokasi belum diisi"
                  />
                )}
              </ChartCard>

              <ChartCard title="Deskripsi">
                <Text style={styles.bodyText}>
                  {asset.description ?? 'Belum ada deskripsi untuk aset ini.'}
                </Text>
              </ChartCard>

              {isAdmin ? (
                <ChartCard title="Kelola aset">
                  <Text style={styles.bodyText}>
                    Perubahan data aset, lokasi, dan jaringan dilakukan dari formulir ubah aset.
                  </Text>
                  <Button
                    icon="create-outline"
                    label="Ubah data aset"
                    onPress={() => router.push(`/asset/${asset.id}/edit`)}
                    variant="secondary"
                  />
                  <Button
                    icon="trash-outline"
                    label="Hapus aset"
                    onPress={() => {
                      setDeleteError(null);
                      setConfirmingDelete(true);
                    }}
                    variant="danger"
                  />
                </ChartCard>
              ) : null}
            </>
          ) : null}

          {tab === 'network' ? (
            <ChartCard title="Informasi jaringan">
              {asset.network ? (
                <DataList>
                  <DataRow label="Hostname" value={asset.network.hostname ?? '-'} />
                  <DataRow label="Alamat IP" value={asset.network.ipAddress ?? '-'} />
                  <DataRow label="Subnet mask" value={asset.network.subnetMask ?? '-'} />
                  <DataRow label="Gateway" value={asset.network.gateway ?? '-'} />
                  <DataRow label="MAC address" value={asset.network.macAddress ?? '-'} />
                  <DataRow label="Terakhir dicek" value={formatDateTime(asset.network.lastChecked)} />
                  <DataRow label="Catatan" value={asset.network.notes ?? '-'} />
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Status koneksi</Text>
                    <StatusPill
                      label={CONNECTION_LABELS[asset.network.connectionStatus]}
                      tone={CONNECTION_TONES[asset.network.connectionStatus]}
                    />
                  </View>
                </DataList>
              ) : (
                <EmptyState
                  illustration="network"
                  message="Data hostname, IP, dan status koneksi belum diisi untuk aset ini."
                  title="Belum ada informasi jaringan"
                />
              )}
            </ChartCard>
          ) : null}

          {tab === 'maintenance' ? (
            <View style={styles.sectionList}>
              {isAdmin ? (
                <Button
                  icon="add"
                  label="Catat maintenance"
                  onPress={() => router.push(`/maintenance/new?assetId=${asset.id}`)}
                  variant="secondary"
                />
              ) : null}
              {maintenanceError ? (
                <ChartCard title="Gagal memuat riwayat">
                  <Text style={styles.bodyText}>{maintenanceError}</Text>
                  <Button label="Coba lagi" onPress={() => void load()} variant="secondary" />
                </ChartCard>
              ) : maintenance.length === 0 ? (
                <ChartCard>
                  <EmptyState
                    illustration="maintenance"
                    message="Catatan perawatan aset ini akan tampil di sini."
                    title="Belum ada riwayat maintenance"
                  />
                </ChartCard>
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
                      <DataList>
                        <DataRow label="Teknisi" value={record.technician?.fullName ?? 'Tidak dicatat'} />
                        <DataRow label="Hasil" value={record.result ?? '-'} />
                      </DataList>
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
                          <Ionicons color={colors.primary} name="chevron-forward" size={14} />
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
                <ChartCard
                  subtitle="Skor dari mesin heuristik berbasis aturan, statistik, dan pola."
                  title="Prediksi Risiko Aktif"
                >
                  <View style={styles.gaugeWrap}>
                    <RiskGauge score={prediction.riskScore} size={240} />
                  </View>
                  <View style={styles.predictionMeta}>
                    <StatusPill
                      label={RISK_LABELS[prediction.riskLevel]}
                      tone={RISK_TONES[prediction.riskLevel]}
                    />
                    <Text style={styles.note}>
                      {prediction.confidence !== null
                        ? `Keyakinan internal ${prediction.confidence}%`
                        : 'Keyakinan internal tidak dicatat'}
                    </Text>
                  </View>

                  <DataList>
                    <DataRow
                      label="Perkiraan kegagalan"
                      value={
                        prediction.predictedFailureDays !== null
                          ? `${prediction.predictedFailureDays} hari`
                          : '-'
                      }
                    />
                    <DataRow label="Versi mesin" value={prediction.modelVersion} />
                    <DataRow label="Diprediksi pada" value={formatDateTime(prediction.predictedAt)} />
                  </DataList>
                  <Text style={styles.note}>
                    Angka ini bukan ramalan pasti dan bukan keluaran model machine learning yang
                    dilatih.
                  </Text>

                  {isAdmin ? (
                    <Button
                      icon="refresh"
                      label="Prediksi ulang"
                      loading={predicting}
                      onPress={handlePredict}
                      variant="secondary"
                    />
                  ) : null}
                </ChartCard>

                <ChartCard
                  subtitle={
                    explanation
                      ? 'Dihitung ulang saat halaman dibuka dan tidak mengubah prediksi tersimpan.'
                      : undefined
                  }
                  title="Rincian Perhitungan"
                >
                  {explanation ? (
                    <DataList>
                      <DataRow
                        label="Lapisan 1 — basis berbobot"
                        value={explanation.layerBreakdown.layer1.baseScore.toFixed(2)}
                      />
                      <DataRow
                        label="Lapisan 2 — penyesuaian statistik"
                        value={formatAdjustment(explanation.layerBreakdown.layer2.total)}
                      />
                      <DataRow
                        label="Lapisan 3 — pencocokan pola"
                        value={formatAdjustment(explanation.layerBreakdown.layer3.total)}
                      />
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                          {explanation.layerBreakdown.final.toFixed(2)}
                        </Text>
                      </View>
                    </DataList>
                  ) : (
                    <Text style={styles.bodyText}>
                      Rincian perhitungan tidak tersedia saat ini.
                    </Text>
                  )}
                </ChartCard>

                <ChartCard title="Faktor Utama">
                  {(prediction.topFactors ?? []).length === 0 ? (
                    <Text style={styles.bodyText}>Tidak ada faktor yang dicatat.</Text>
                  ) : (
                    (prediction.topFactors ?? []).map((factor) => (
                      <View key={factor.name} style={styles.factorRow}>
                        <View style={styles.factorHeader}>
                          <Text style={styles.factorName}>
                            {FACTOR_LABELS[factor.name] ?? factor.name}
                          </Text>
                          <Text style={styles.factorImpact}>{formatAdjustment(factor.impact)}</Text>
                        </View>
                        <View style={styles.factorTrack}>
                          <View
                            style={[
                              styles.factorFill,
                              {
                                backgroundColor:
                                  factor.impact >= 0 ? colors.danger : colors.success,
                                width: `${
                                  maxImpact > 0
                                    ? Math.max((Math.abs(factor.impact) / maxImpact) * 100, 4)
                                    : 0
                                }%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.factorDescription}>{factor.description}</Text>
                      </View>
                    ))
                  )}
                </ChartCard>

                <ChartCard title="Rekomendasi">
                  <Text style={styles.bodyText}>
                    {prediction.recommendation ?? 'Belum ada rekomendasi.'}
                  </Text>
                </ChartCard>
              </View>
            ) : (
              <ChartCard>
                <EmptyState
                  illustration="prediction"
                  message="Prediksi risiko akan tampil di sini setelah administrator menjalankan analisis."
                  title="Belum ada prediksi"
                />
                {isAdmin ? (
                  <Button
                    icon="pulse-outline"
                    label="Prediksi sekarang"
                    loading={predicting}
                    onPress={handlePredict}
                  />
                ) : null}
              </ChartCard>
            )
          ) : null}
        </View>
      </Animated.ScrollView>

      <Toast
        message={predictNotice}
        tone={predictNotice?.startsWith('Gagal') ? 'danger' : 'success'}
        top={insets.top + 56}
      />

      <ConfirmDialog
        busy={deleting}
        confirmLabel="Hapus"
        message={
          deleteError ??
          `Aset ${asset.assetCode} — ${asset.assetName} akan dihapus permanen. Aset yang sudah memiliki riwayat maintenance atau prediksi tidak dapat dihapus.`
        }
        onCancel={() => {
          if (!deleting) {
            setConfirmingDelete(false);
            setDeleteError(null);
          }
        }}
        onConfirm={() => void handleDelete()}
        title={deleteError ? 'Aset tidak dapat dihapus' : 'Hapus aset?'}
        visible={confirmingDelete}
      />
    </SafeAreaView>
  );
}

function CompactHeader({
  title,
  onBack,
  right,
  insets,
}: {
  title: string;
  onBack: () => void;
  right: React.ReactNode;
  insets: number;
}) {
  return (
    <View style={[styles.compactBar, { opacity: 1, paddingTop: insets }]}>
      <View style={styles.compactBarInner}>
        <Pressable
          accessibilityLabel="Kembali"
          accessibilityRole="button"
          hitSlop={6}
          onPress={onBack}
          style={styles.compactButton}
        >
          <Ionicons color={colors.text} name="arrow-back" size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.compactTitle}>
          {title}
        </Text>
        <View style={styles.compactButton}>{right}</View>
      </View>
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
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  compactBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  compactBarInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  compactButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
  },
  compactTitle: {
    ...text.heading,
    flex: 1,
    textAlign: 'center',
  },
  floatingActions: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 9,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  floatingButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  hero: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  heroBlob: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    height: 200,
    position: 'absolute',
    right: -60,
    top: -40,
    width: 200,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroType: {
    ...text.label,
    color: colors.onPrimary,
    flex: 1,
  },
  heroName: {
    ...text.display,
    color: colors.onPrimary,
    marginTop: spacing.md,
  },
  heroCode: {
    ...text.caption,
    color: colors.onPrimaryMuted,
    marginTop: 2,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },
  sectionList: {
    gap: spacing.lg,
  },
  gaugeWrap: {
    alignItems: 'center',
  },
  predictionMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  note: {
    ...text.caption,
    color: colors.muted,
    flexShrink: 1,
  },
  statusLabel: {
    ...text.caption,
    color: colors.muted,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  bodyText: {
    ...text.body,
    color: colors.textSecondary,
  },
  recordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordDate: {
    ...text.small,
    color: colors.muted,
  },
  recordDescription: {
    ...text.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  recordFooter: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 2,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  recordMeta: {
    ...text.small,
    color: colors.muted,
  },
  recordLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginTop: spacing.xs,
  },
  recordLink: {
    ...text.captionStrong,
    color: colors.primary,
  },
  factorRow: {
    gap: 4,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factorName: {
    ...text.captionStrong,
    flex: 1,
  },
  factorImpact: {
    ...text.small,
    color: colors.dangerInk,
    fontVariant: ['tabular-nums'],
  },
  factorTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 6,
    overflow: 'hidden',
  },
  factorFill: {
    borderRadius: radius.pill,
    height: '100%',
  },
  factorDescription: {
    ...text.small,
    color: colors.muted,
  },
  totalRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  totalLabel: {
    ...text.captionStrong,
    color: colors.text,
  },
  totalValue: {
    ...text.captionStrong,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  refreshErrorBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  refreshErrorText: {
    ...text.caption,
    color: colors.dangerInk,
    flex: 1,
  },
  pressedCard: {
    opacity: 0.9,
  },
  skeletonWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 80,
  },
  stateWrap: {
    padding: spacing.lg,
    paddingTop: 80,
  },
});
