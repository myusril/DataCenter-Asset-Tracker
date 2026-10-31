import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchRiskExplanation, fetchRiskSummary, predictAllAssets } from '../../api/ai';
import { extractErrorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { RiskBar } from '../../components/RiskBar';
import { StatusPill } from '../../components/StatusPill';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
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

export default function AiScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [explainAssetId, setExplainAssetId] = useState<number | null>(null);

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
      const failed =
        result.failed.length > 0 ? ` · ${result.failed.length} gagal` : '';
      setToast(
        `Prediksi selesai: ${result.processed} aset diproses · ${result.high} tinggi · ` +
          `${result.medium} sedang · ${result.low} rendah · ${result.alertsCreated} alert baru${failed}.`,
      );
      await load(true);
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setPredicting(false);
    }
  }

  const counts = risk?.counts ?? { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const topAssets = risk?.topRiskAssets ?? [];

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
          <Text style={styles.title}>Analisis Risiko</Text>
          <Text style={styles.subtitle}>
            Mesin heuristik deterministik (aturan, statistik, dan pola). Bukan model machine learning
            yang dilatih.
          </Text>
        </View>

        {toast ? (
          <View style={styles.toast}>
            <Ionicons color={colors.success} name="checkmark-circle" size={18} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {loading && !risk ? <Loading message="Memuat analisis..." /> : null}

        {error && !risk ? (
          <Card title="Gagal memuat analisis">
            <Text style={styles.bodyText}>{error}</Text>
            <Button label="Coba lagi" onPress={() => void load()} style={styles.retry} />
          </Card>
        ) : null}

        {risk ? (
          <>
            <Card subtitle={`Prediksi terakhir: ${formatDateTime(risk.lastPredictedAt)}`} title="Ringkasan">
              <View style={styles.averageRow}>
                <Text style={styles.average}>{risk.averageScore.toFixed(2)}</Text>
                <View style={styles.averageMeta}>
                  <Text style={styles.averageLabel}>skor risiko rata-rata</Text>
                  <Text style={styles.averageLabel}>dari 100</Text>
                </View>
              </View>

              <View style={styles.levelGrid}>
                {LEVELS.map((level) => (
                  <View key={level} style={styles.levelCard}>
                    <StatusPill label={RISK_LABELS[level]} tone={RISK_TONES[level]} />
                    <Text style={styles.levelCount}>{counts[level]}</Text>
                    <Text style={styles.levelLabel}>
                      {level === 'HIGH' ? 'aset tinggi' : level === 'MEDIUM' ? 'aset sedang' : 'aset rendah'}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.metaNote}>
                {risk.assetsWithoutPrediction} aset belum memiliki prediksi.
              </Text>

              {isAdmin ? (
                <Button
                  label="Prediksi semua aset"
                  loading={predicting}
                  onPress={handlePredictAll}
                  style={styles.predictButton}
                />
              ) : (
                <Text style={styles.roleNote}>
                  Hanya administrator yang dapat menjalankan prediksi ulang.
                </Text>
              )}
            </Card>

            <Text style={styles.sectionTitle}>Aset Berisiko Tertinggi</Text>
            <Card
              subtitle={
                topAssets.length > 0
                  ? 'Maksimal 5 aset aktif berlevel sedang atau tinggi. Ketuk baris untuk membuka aset, ikon info untuk rincian.'
                  : undefined
              }
            >
              {topAssets.length === 0 ? (
                <EmptyState
                  icon="shield-checkmark-outline"
                  message="Belum ada aset berisiko sedang atau tinggi pada prediksi aktif."
                  title="Tidak ada aset berisiko"
                />
              ) : (
                topAssets.map((asset, index) => (
                  <View key={asset.assetId} style={styles.riskRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/asset/${asset.assetId}`)}
                      style={({ pressed }) => [styles.riskBody, pressed ? styles.pressed : null]}
                    >
                      <View style={styles.riskHeader}>
                        <Text style={styles.rank}>{index + 1}</Text>
                        <View style={styles.riskTitle}>
                          <Text numberOfLines={1} style={styles.riskName}>
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
                      onPress={() => setExplainAssetId(asset.assetId)}
                      style={styles.infoButton}
                    >
                      <Ionicons color={colors.accent} name="information-circle-outline" size={22} />
                    </Pressable>
                  </View>
                ))
              )}
            </Card>

            {error ? (
              <Text style={styles.inlineError}>Data terakhir gagal diperbarui: {error}</Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <ExplainModal assetId={explainAssetId} onClose={() => setExplainAssetId(null)} />
    </SafeAreaView>
  );
}

function ExplainModal({
  assetId,
  onClose,
}: {
  assetId: number | null;
  onClose: () => void;
}) {
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

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={assetId !== null}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rincian Perhitungan Risiko</Text>
            <Pressable accessibilityLabel="Tutup" accessibilityRole="button" onPress={onClose}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.modalHint}>Menghitung ulang skor...</Text>
            </View>
          ) : null}

          {error && !loading ? (
            <Text style={styles.bodyText}>{error}</Text>
          ) : null}

          {explanation && !loading ? (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.modalAsset}>
                {explanation.assetCode} · {explanation.assetName}
              </Text>
              <View style={styles.modalScoreRow}>
                <Text style={styles.modalScore}>{explanation.riskScore.toFixed(1)}</Text>
                <View style={styles.modalScoreMeta}>
                  <Text style={styles.modalHint}>dari 100</Text>
                  <StatusPill
                    label={RISK_LABELS[explanation.riskLevel]}
                    tone={RISK_TONES[explanation.riskLevel]}
                  />
                </View>
              </View>
              <RiskBar level={explanation.riskLevel} score={explanation.riskScore} thickness={10} />

              <Text style={styles.modalParagraph}>{explanation.explanation}</Text>

              <Text style={styles.modalSectionTitle}>Lapisan perhitungan</Text>
              <ModalRow
                label="1 — skor dasar berbobot"
                value={explanation.layerBreakdown.layer1.baseScore.toFixed(2)}
              />
              <ModalRow
                label="2 — penyesuaian statistik"
                value={formatAdjustment(explanation.layerBreakdown.layer2.total)}
              />
              <ModalRow
                label="3 — pencocokan pola"
                value={formatAdjustment(explanation.layerBreakdown.layer3.total)}
              />
              <ModalRow label="Total" value={explanation.layerBreakdown.final.toFixed(2)} />

              <Text style={styles.modalSectionTitle}>Faktor utama</Text>
              {explanation.topFactors.map((factor) => (
                <View key={factor.name} style={styles.modalFactor}>
                  <View style={styles.modalFactorHeader}>
                    <Text style={styles.modalFactorName}>
                      {FACTOR_LABELS[factor.name] ?? factor.name}
                    </Text>
                    <Text style={styles.modalFactorImpact}>{formatAdjustment(factor.impact)}</Text>
                  </View>
                  <Text style={styles.modalHint}>{factor.description}</Text>
                </View>
              ))}

              <Text style={styles.modalSectionTitle}>Rekomendasi</Text>
              <Text style={styles.modalParagraph}>{explanation.recommendation}</Text>

              <Text style={styles.modalNote}>
                Nilai dihitung ulang saat dialog dibuka dan tidak mengubah prediksi tersimpan. Model:{' '}
                {explanation.modelVersion}.
                {isAdmin ? '' : ' Hanya administrator yang dapat menyimpan prediksi baru.'}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.modalRow}>
      <Text style={styles.modalRowLabel}>{label}</Text>
      <Text style={styles.modalRowValue}>{value}</Text>
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
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  toast: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  toastText: {
    color: colors.success,
    flex: 1,
    fontSize: typography.small,
    lineHeight: 18,
  },
  averageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  average: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  averageMeta: {
    paddingBottom: spacing.sm,
  },
  averageLabel: {
    color: colors.muted,
    fontSize: typography.small,
  },
  levelGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  levelCard: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    flex: 1,
    gap: 2,
    paddingVertical: spacing.md,
  },
  levelCount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  levelLabel: {
    color: colors.muted,
    fontSize: typography.small,
  },
  metaNote: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: spacing.md,
  },
  predictButton: {
    marginTop: spacing.md,
  },
  roleNote: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  riskRow: {
    alignItems: 'stretch',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  riskBody: {
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  riskHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rank: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
    marginTop: 2,
    width: 14,
  },
  riskTitle: {
    flex: 1,
  },
  riskName: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  riskCode: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 1,
  },
  riskScoreBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  riskScore: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  riskMeta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  infoButton: {
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  overlay: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '85%',
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    flex: 1,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  modalLoading: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  modalBody: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  modalAsset: {
    color: colors.muted,
    fontSize: typography.small,
  },
  modalScoreRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalScore: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
  },
  modalScoreMeta: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  modalHint: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
  },
  modalParagraph: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  modalSectionTitle: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  modalRowLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
  },
  modalRowValue: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '600',
  },
  modalFactor: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  modalFactorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalFactorName: {
    color: colors.text,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '600',
  },
  modalFactorImpact: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
  },
  modalNote: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  retry: {
    marginTop: spacing.lg,
  },
  inlineError: {
    color: colors.danger,
    fontSize: typography.small,
  },
});
