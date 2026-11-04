import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage } from '../../api/client';
import { fetchMaintenanceDetail } from '../../api/maintenance';
import { ChartCard } from '../../components/ChartCard';
import { DataList, DataRow } from '../../components/DataList';
import { EmptyState } from '../../components/EmptyState';
import { GradientHeader } from '../../components/GradientHeader';
import { IconButton } from '../../components/IconButton';
import { RecordDetailSkeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { gradients, layout } from '../../theme/tokens';
import { text } from '../../theme/typography';
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
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style="light" />

      {record ? (
        <GradientHeader
          colors={gradients.heroDeep}
          eyebrow="Detail catatan perawatan"
          left={
            <IconButton
              accessibilityLabel="Kembali"
              icon="arrow-back"
              onPress={() => router.back()}
              tone="glass"
            />
          }
          subtitle={record.asset?.assetCode ?? '-'}
          title={record.asset?.assetName ?? `Aset #${record.assetId}`}
          variant="compact"
        >
          <View style={styles.heroTopRow}>
            <StatusPill
              label={MAINTENANCE_TYPE_LABELS[record.maintenanceType]}
              tone={MAINTENANCE_TYPE_TONES[record.maintenanceType]}
            />
            <Text style={styles.heroDate}>{formatDate(record.maintenanceDate)}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/asset/${record.assetId}`)}
            style={({ pressed }) => [styles.assetLink, pressed ? styles.pressed : null]}
          >
            <View style={styles.assetLinkIcon}>
              <Ionicons color={colors.primary} name="cube-outline" size={16} />
            </View>
            <Text style={styles.assetLinkText}>Buka detail aset</Text>
            <Ionicons color={colors.onPrimaryMuted} name="chevron-forward" size={16} />
          </Pressable>
        </GradientHeader>
      ) : (
        <GradientHeader
          eyebrow="Riwayat perawatan"
          left={
            <IconButton
              accessibilityLabel="Kembali"
              icon="arrow-back"
              onPress={() => router.back()}
              tone="glass"
            />
          }
          subtitle="Rincian pekerjaan, biaya, dan hasil."
          title="Detail Maintenance"
          variant="compact"
        />
      )}

      {loading && !record ? (
        <View style={styles.skeletonWrap}>
          <RecordDetailSkeleton />
        </View>
      ) : null}

      {!record && !loading ? (
        <View style={styles.stateWrap}>
          <ChartCard>
            <EmptyState
              action={{ label: 'Coba lagi', onPress: () => void load() }}
              illustration="error"
              message={error ?? 'Catatan tidak ditemukan.'}
              title="Gagal memuat catatan"
            />
          </ChartCard>
        </View>
      ) : null}

      {record ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ChartCard title="Pelaksanaan">
            <DataList>
              <DataRow label="Teknisi" value={record.technician?.fullName ?? 'Tidak dicatat'} />
              <DataRow label="Biaya" value={formatCurrency(record.cost)} />
              <DataRow label="Jadwal berikutnya" value={formatDate(record.nextSchedule)} />
              <DataRow label="Dibuat" value={formatDateTime(record.createdAt)} />
              {record.updatedAt !== record.createdAt ? (
                <DataRow label="Diperbarui" value={formatDateTime(record.updatedAt)} />
              ) : null}
            </DataList>
          </ChartCard>

          <ChartCard title="Uraian">
            <Text style={styles.bodyText}>
              {record.description ?? 'Belum ada uraian pekerjaan yang dicatat.'}
            </Text>
          </ChartCard>

          <ChartCard title="Hasil">
            <Text style={styles.bodyText}>
              {record.result ?? 'Belum ada hasil yang dicatat.'}
            </Text>
            {record.result?.trim().toLowerCase().startsWith('resolved') ? (
              <View style={styles.hintBox}>
                <Ionicons color={colors.successInk} name="checkmark-circle" size={16} />
                <Text style={styles.hint}>
                  Hasil diawali &quot;Resolved&quot;, sehingga status aset otomatis menjadi Aktif.
                </Text>
              </View>
            ) : null}
          </ChartCard>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroDate: {
    ...text.captionStrong,
    color: colors.onPrimaryMuted,
  },
  assetLink: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  assetLinkIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  assetLinkText: {
    ...text.captionStrong,
    color: colors.onPrimary,
    flex: 1,
  },
  skeletonWrap: {
    paddingTop: spacing.lg,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.huge,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
  },
  bodyText: {
    ...text.body,
  },
  hintBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  hint: {
    ...text.small,
    color: colors.successInk,
    flex: 1,
  },
  stateWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },
  inlineError: {
    ...text.caption,
    color: colors.dangerInk,
  },
  pressed: {
    opacity: 0.85,
  },
});
