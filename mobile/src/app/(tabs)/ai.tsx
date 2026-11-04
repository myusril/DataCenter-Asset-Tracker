import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchRiskExplanation, fetchRiskSummary, predictAllAssets } from '../../api/ai';
import { extractErrorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { ChartCard } from '../../components/ChartCard';
import { DataList, DataRow } from '../../components/DataList';
import { EmptyState } from '../../components/EmptyState';
import { GradientHeader } from '../../components/GradientHeader';
import { RiskBar } from '../../components/RiskBar';
import { RiskGauge } from '../../components/RiskGauge';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { Sheet } from '../../components/Sheet';
import { RiskSkeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { Toast } from '../../components/Toast';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useNotificationStore } from '../../store/notifications';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { layout } from '../../theme/tokens';
import { text } from '../../theme/typography';
import type { RiskExplanation, RiskLevel, RiskSummary } from '../../types/api';
import { formatDateTime, RISK_LABELS } from '../../utils/format';
import { RISK_TONES } from '../../utils/pills';

const LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

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

const LAYERS = [
  {
    key: 'rules',
    label: 'Aturan',
    title: 'Lapisan 1 — aturan',
    body: 'Skor dasar dihitung dari bobot faktor yang terukur: usia aset, status, frekuensi maintenance, insiden perbaikan, dan kondisi jaringan.',
  },
  {
    key: 'stats',
    label: 'Statistik',
    title: 'Lapisan 2 — statistik',
    body: 'Interval maintenance dibandingkan dengan riwayat aset itu sendiri (deviasi) dan dengan aset sejenis (peer).',
  },
  {
    key: 'pattern',
    label: 'Pola',
    title: 'Lapisan 3 — pola',
    body: 'Kombinasi kejadian seperti jaringan offline berulang dan perbaikan berulang menambah penyesuaian pada skor.',
  },
] as const;

type MethodLayer = (typeof LAYERS)[number]['key'];

export default function RiskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const refreshUnread = useNotificationStore((state) => state.refreshUnread);

  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [explainAssetId, setExplainAssetId] = useState<number | null>(null);
  const [methodLayer, setMethodLayer] = useState<MethodLayer>('rules');
  const [methodOpen, setMethodOpen] = useState(false);

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
      const summary = await fetchRiskSummary();
      if (currentRequest !== requestId.current) {
        return;
      }
      setRisk(summary);
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

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handlePredictAll() {
    if (predicting) {
      return;
    }
    setPredicting(true);
    setError(null);
    try {
      const result = await predictAllAssets();
      const failed = result.failed.length > 0 ? ` · ${result.failed.length} gagal` : '';
      setToast(
        `Prediksi selesai: ${result.processed} aset diproses · ${result.high} tinggi · ` +
          `${result.medium} sedang · ${result.low} rendah · ${result.alertsCreated} alert baru${failed}.`,
      );
      await load(true);
      await refreshUnread();
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setPredicting(false);
    }
  }

  const counts = risk?.counts ?? { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const topAssets = risk?.topRiskAssets ?? [];
  const activeLayer = LAYERS.find((layer) => layer.key === methodLayer) ?? LAYERS[0];

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
          eyebrow="Mesin heuristik deterministik"
          right={
            <Pressable
              accessibilityLabel="Cara kerja penilaian risiko"
              accessibilityRole="button"
              onPress={() => setMethodOpen(true)}
              style={styles.headerInfo}
            >
              <Ionicons color={colors.onPrimary} name="help-circle-outline" size={20} />
            </Pressable>
          }
          subtitle="Skor untuk memprioritaskan inspeksi, bukan ramalan model yang dilatih."
          title="Risiko"
          variant="compact"
        />

        <View style={styles.body}>
          <Toast message={toast} />

          {loading && !risk ? <RiskSkeleton /> : null}

          {error && !risk ? (
            <ChartCard>
              <EmptyState
                action={{ label: 'Coba lagi', onPress: () => void load() }}
                illustration="error"
                message={error}
                title="Gagal memuat analisis"
              />
            </ChartCard>
          ) : null}

          {risk ? (
            <>
              <ChartCard
                subtitle={
                  risk.lastPredictedAt
                    ? `Prediksi aktif terakhir ${formatDateTime(risk.lastPredictedAt)}`
                    : 'Belum ada prediksi tersimpan'
                }
                title="Skor Risiko Rata-rata"
              >
                <View style={styles.gaugeWrap}>
                  <RiskGauge score={risk.averageScore} />
                </View>

                <View style={styles.levelRow}>
                  {LEVELS.map((level) => (
                    <View key={level} style={styles.levelCard}>
                      <StatusPill
                        label={RISK_LABELS[level]}
                        style={styles.levelPill}
                        tone={RISK_TONES[level]}
                      />
                      <Text style={styles.levelCount}>{counts[level]}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.note}>
                  {risk.assetsWithoutPrediction} aset belum memiliki prediksi.
                </Text>

                {isAdmin ? (
                  <Button
                    icon="pulse-outline"
                    label="Prediksi semua aset"
                    loading={predicting}
                    onPress={handlePredictAll}
                  />
                ) : (
                  <Text style={styles.note}>
                    Hanya administrator yang dapat menjalankan prediksi ulang.
                  </Text>
                )}
              </ChartCard>

              <ChartCard
                right={<Text style={styles.cardBadge}>3 lapisan</Text>}
                title="Cara Kerja"
              >
                {LAYERS.map((layer, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={layer.key}
                    onPress={() => {
                      setMethodLayer(layer.key);
                      setMethodOpen(true);
                    }}
                    style={({ pressed }) => [styles.layerRow, pressed ? styles.pressed : null]}
                  >
                    <View style={styles.layerIndex}>
                      <Text style={styles.layerIndexLabel}>{index + 1}</Text>
                    </View>
                    <View style={styles.layerText}>
                      <Text style={styles.layerTitle}>{layer.label}</Text>
                      <Text style={styles.layerBody}>{layer.body}</Text>
                    </View>
                    <Ionicons color={colors.muted} name="chevron-forward" size={16} />
                  </Pressable>
                ))}
                <Text style={styles.note}>
                  Input yang sama menghasilkan skor yang sama. Tidak ada akurasi model yang diklaim.
                </Text>
              </ChartCard>

              <ChartCard
                subtitle={
                  topAssets.length > 0
                    ? 'Maksimal 5 aset aktif berlevel sedang atau tinggi. Ketuk baris untuk membuka aset.'
                    : undefined
                }
                title="Aset Berisiko Tertinggi"
              >
                {topAssets.length === 0 ? (
                  <EmptyState
                    compact
                    illustration="prediction"
                    message="Belum ada aset berisiko sedang atau tinggi pada prediksi aktif."
                    title="Tidak ada aset berisiko"
                  />
                ) : (
                  <View style={styles.riskList}>
                    {topAssets.map((asset, index) => (
                      <View key={asset.assetId} style={styles.riskRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => router.push(`/asset/${asset.assetId}`)}
                          style={({ pressed }) => [styles.riskBody, pressed ? styles.pressed : null]}
                        >
                          <View style={styles.riskHeader}>
                            <View style={styles.rank}>
                              <Text style={styles.rankLabel}>{index + 1}</Text>
                            </View>
                            <View style={styles.riskTitle}>
                              <Text numberOfLines={2} style={styles.riskName}>
                                {asset.assetName}
                              </Text>
                              <Text style={styles.riskCode}>{asset.assetCode}</Text>
                            </View>
                            <View style={styles.riskScoreBlock}>
                              <Text style={styles.riskScore}>{asset.riskScore.toFixed(1)}</Text>
                              <StatusPill
                                label={RISK_LABELS[asset.riskLevel]}
                                tone={RISK_TONES[asset.riskLevel]}
                              />
                            </View>
                          </View>
                          <RiskBar level={asset.riskLevel} score={asset.riskScore} />
                          <Text style={styles.riskMeta}>
                            Perkiraan kegagalan: {asset.predictedFailureDays ?? '-'} hari ·{' '}
                            {formatDateTime(asset.predictedAt)}
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityLabel={`Rincian perhitungan ${asset.assetCode}`}
                          accessibilityRole="button"
                          hitSlop={6}
                          onPress={() => setExplainAssetId(asset.assetId)}
                          style={styles.infoButton}
                        >
                          <Ionicons color={colors.primary} name="information-circle-outline" size={22} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </ChartCard>

              {error ? (
                <Text style={styles.inlineError}>Data terakhir gagal diperbarui: {error}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <ExplainSheet assetId={explainAssetId} onClose={() => setExplainAssetId(null)} />

      <Sheet
        onClose={() => setMethodOpen(false)}
        subtitle="Sama input, sama output — dihitung ulang setiap kali."
        title="Cara kerja penilaian"
        visible={methodOpen}
      >
        <SegmentedTabs
          active={methodLayer}
          items={LAYERS.map((layer) => ({ key: layer.key, label: layer.label }))}
          onChange={(key) => setMethodLayer(key)}
        />
        <View style={styles.methodCard}>
          <Text style={styles.methodTitle}>{activeLayer.title}</Text>
          <Text style={styles.methodBody}>{activeLayer.body}</Text>
        </View>
        <View style={styles.methodCard}>
          <Text style={styles.methodTitle}>Yang perlu diketahui</Text>
          <Text style={styles.methodBody}>
            Skor 0–100 adalah perkiraan untuk memprioritaskan inspeksi. Mesin ini tidak dilatih
            dengan data historis dan tidak memiliki angka akurasi; hasilnya berasal dari aturan
            bobot, statistik riwayat maintenance, dan pola kejadian yang dapat diperiksa ulang.
          </Text>
        </View>
        <View style={styles.methodCard}>
          <Text style={styles.methodTitle}>Istilah</Text>
          <Text style={styles.methodBody}>
            Skor tinggi berarti perlu inspeksi lebih cepat. Perkiraan kegagalan adalah sisa hari
            sebelum aset diperkirakan bermasalah menurut perhitungan yang sama, bukan ramalan pasti.
          </Text>
        </View>
        <Button label="Mengerti" onPress={() => setMethodOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function ExplainSheet({ assetId, onClose }: { assetId: number | null; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const [explanation, setExplanation] = useState<RiskExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assetId === null) {
      setExplanation(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setExplanation(null);

    fetchRiskExplanation(assetId)
      .then((data) => {
        if (active) {
          setExplanation(data);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(extractErrorMessage(caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [assetId]);

  const maxImpact = Math.max(
    ...(explanation?.topFactors ?? []).map((factor) => Math.abs(factor.impact)),
    0,
  );

  return (
    <Sheet
      onClose={onClose}
      subtitle={explanation ? `${explanation.assetCode} · ${explanation.assetName}` : 'Menghitung ulang skor...'}
      title="Rincian Perhitungan"
      visible={assetId !== null}
    >
      {loading ? (
        <View style={styles.sheetLoading}>
          <RiskSkeleton />
        </View>
      ) : null}

      {error && !loading ? (
        <View style={styles.methodCard}>
          <Text style={styles.methodTitle}>Rincian tidak tersedia</Text>
          <Text style={styles.methodBody}>{error}</Text>
        </View>
      ) : null}

      {explanation && !loading ? (
        <>
          <View style={styles.sheetScoreRow}>
            <Text style={styles.sheetScore}>{explanation.riskScore.toFixed(1)}</Text>
            <View style={styles.sheetScoreMeta}>
              <Text style={styles.note}>dari 100</Text>
              <StatusPill
                label={RISK_LABELS[explanation.riskLevel]}
                tone={RISK_TONES[explanation.riskLevel]}
              />
            </View>
          </View>

          <Text style={styles.sheetParagraph}>{explanation.explanation}</Text>

          <View style={styles.methodCard}>
            <Text style={styles.methodTitle}>Lapisan perhitungan</Text>
            <DataList>
              <DataRow label="1 — skor dasar berbobot" value={explanation.layerBreakdown.layer1.baseScore.toFixed(2)} />
              <DataRow label="2 — penyesuaian statistik" value={formatAdjustment(explanation.layerBreakdown.layer2.total)} />
              <DataRow label="3 — pencocokan pola" value={formatAdjustment(explanation.layerBreakdown.layer3.total)} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{explanation.layerBreakdown.final.toFixed(2)}</Text>
              </View>
            </DataList>
          </View>

          <View style={styles.methodCard}>
            <Text style={styles.methodTitle}>Faktor utama</Text>
            {explanation.topFactors.map((factor) => (
              <View key={factor.name} style={styles.factorRow}>
                <View style={styles.factorHeader}>
                  <Text style={styles.factorName}>{FACTOR_LABELS[factor.name] ?? factor.name}</Text>
                  <Text style={styles.factorImpact}>{formatAdjustment(factor.impact)}</Text>
                </View>
                <View style={styles.factorTrack}>
                  <View
                    style={[
                      styles.factorFill,
                      {
                        backgroundColor: factor.impact >= 0 ? colors.danger : colors.success,
                        width: `${
                          maxImpact > 0 ? Math.max((Math.abs(factor.impact) / maxImpact) * 100, 4) : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.factorDescription}>{factor.description}</Text>
              </View>
            ))}
          </View>

          <View style={styles.methodCard}>
            <Text style={styles.methodTitle}>Rekomendasi</Text>
            <Text style={styles.sheetParagraph}>{explanation.recommendation}</Text>
          </View>

          <Text style={styles.note}>
            Nilai dihitung ulang saat panel dibuka dan tidak mengubah prediksi tersimpan. Mesin:{' '}
            {explanation.modelVersion}.
            {isAdmin ? '' : ' Hanya administrator yang dapat menyimpan prediksi baru.'}
          </Text>
        </>
      ) : null}
    </Sheet>
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
  headerInfo: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  body: {
    gap: layout.sectionGap,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
  },
  cardBadge: {
    ...text.small,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    color: colors.textSecondary,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  gaugeWrap: {
    alignItems: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  levelCard: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.md,
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  levelPill: {
    alignSelf: 'center',
  },
  levelCount: {
    ...text.metric,
  },
  note: {
    ...text.caption,
    color: colors.muted,
  },
  layerRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  layerIndex: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  layerIndexLabel: {
    ...text.captionStrong,
    color: colors.primary,
  },
  layerText: {
    flex: 1,
    gap: 2,
  },
  layerTitle: {
    ...text.captionStrong,
    color: colors.text,
  },
  layerBody: {
    ...text.caption,
    color: colors.muted,
  },
  riskList: {
    gap: spacing.lg,
  },
  riskRow: {
    alignItems: 'stretch',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: spacing.md,
  },
  riskBody: {
    flex: 1,
    gap: spacing.xs,
  },
  riskHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rank: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  rankLabel: {
    ...text.small,
    color: colors.textSecondary,
  },
  riskTitle: {
    flex: 1,
  },
  riskName: {
    ...text.captionStrong,
    fontSize: 13,
    lineHeight: 18,
  },
  riskCode: {
    ...text.small,
    color: colors.muted,
    marginTop: 1,
  },
  riskScoreBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  riskScore: {
    ...text.heading,
    fontVariant: ['tabular-nums'],
  },
  riskMeta: {
    ...text.small,
    color: colors.muted,
  },
  infoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    paddingLeft: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  inlineError: {
    ...text.caption,
    color: colors.dangerInk,
  },
  methodCard: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  methodTitle: {
    ...text.captionStrong,
    color: colors.text,
  },
  methodBody: {
    ...text.caption,
    color: colors.textSecondary,
  },
  sheetLoading: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetScoreRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sheetScore: {
    ...text.metricLarge,
    fontSize: 36,
    lineHeight: 42,
  },
  sheetScoreMeta: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  sheetParagraph: {
    ...text.body,
    color: colors.textSecondary,
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
});
