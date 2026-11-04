import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage } from '../../api/client';
import { fetchMaintenanceDetail } from '../../api/maintenance';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusPill } from '../../components/StatusPill';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import type { MaintenanceRecord } from '../../types/api';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  MAINTENANCE_TYPE_LABELS,
} from '../../utils/format';
import { MAINTENANCE_TYPE_TONES } from '../../utils/pills';

export default function MaintenanceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordId = Number(id);

  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(recordId) || recordId <= 0) {
      setError('Catatan maintenance tidak ditemukan.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRecord(await fetchMaintenanceDetail(recordId));
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} title="Detail Maintenance" />

      {loading && !record ? <Loading message="Memuat catatan..." /> : null}

      {!record && !loading ? (
        <View style={styles.stateBox}>
          <Card title="Gagal memuat catatan">
            <Text style={styles.bodyText}>{error ?? 'Catatan tidak ditemukan.'}</Text>
            <Button label="Coba lagi" onPress={() => void load()} style={styles.retry} />
          </Card>
        </View>
      ) : null}

      {record ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <View style={styles.headerRow}>
              <StatusPill
                label={MAINTENANCE_TYPE_LABELS[record.maintenanceType]}
                tone={MAINTENANCE_TYPE_TONES[record.maintenanceType]}
              />
              <Text style={styles.date}>{formatDate(record.maintenanceDate)}</Text>
            </View>
            <Text style={styles.title}>
              {record.asset?.assetName ?? `Aset #${record.assetId}`}
            </Text>
            <Text style={styles.subtitle}>{record.asset?.assetCode ?? '-'}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/asset/${record.assetId}`)}
              style={({ pressed }) => [styles.assetLink, pressed ? styles.pressed : null]}
            >
              <Ionicons color={colors.accent} name="cube-outline" size={16} />
              <Text style={styles.assetLinkText}>Buka detail aset</Text>
              <Ionicons color={colors.muted} name="chevron-forward" size={16} />
            </Pressable>
          </Card>

          <Card title="Pelaksanaan">
            <InfoRow label="Teknisi" value={record.technician?.fullName ?? 'Tidak dicatat'} />
            <InfoRow label="Biaya" value={formatCurrency(record.cost)} />
            <InfoRow label="Jadwal berikutnya" value={formatDate(record.nextSchedule)} />
            <InfoRow label="Dibuat" value={formatDateTime(record.createdAt)} />
            {record.updatedAt !== record.createdAt ? (
              <InfoRow label="Diperbarui" value={formatDateTime(record.updatedAt)} />
            ) : null}
          </Card>

          <Card title="Uraian">
            <Text style={styles.bodyText}>
              {record.description ?? 'Belum ada uraian pekerjaan yang dicatat.'}
            </Text>
          </Card>

          <Card title="Hasil">
            <Text style={styles.bodyText}>
              {record.result ?? 'Belum ada hasil yang dicatat.'}
            </Text>
            {record.result?.trim().toLowerCase().startsWith('resolved') ? (
              <Text style={styles.hint}>
                Hasil diawali &quot;Resolved&quot;, sehingga status aset otomatis menjadi Aktif.
              </Text>
            ) : null}
          </Card>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </ScrollView>
      ) : null}
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
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  date: {
    color: colors.muted,
    fontSize: typography.small,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: 2,
  },
  assetLink: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  assetLinkText: {
    color: colors.accent,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  infoValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.caption,
    fontWeight: '500',
    textAlign: 'right',
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 21,
  },
  hint: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  stateBox: {
    padding: spacing.lg,
  },
  retry: {
    marginTop: spacing.lg,
  },
  inlineError: {
    color: colors.danger,
    fontSize: typography.small,
  },
});
