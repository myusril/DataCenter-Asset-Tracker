import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage } from '../api/client';
import { fetchMaintenanceList } from '../api/maintenance';
import { ChartCard } from '../components/ChartCard';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { GradientHeader } from '../components/GradientHeader';
import { IconButton } from '../components/IconButton';
import { ListSkeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { elevation, layout } from '../theme/tokens';
import { text } from '../theme/typography';
import type {
  MaintenanceRecord,
  MaintenanceType,
  Pagination,
} from '../types/api';
import { formatDate, MAINTENANCE_TYPE_LABELS } from '../utils/format';
import { MAINTENANCE_TYPE_TONES } from '../utils/pills';

const PAGE_SIZE = 8;

const TYPE_OPTIONS: Array<{ value: MaintenanceType | null; label: string }> = [
  { value: null, label: 'Semua' },
  ...(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map((value) => ({
    value,
    label: MAINTENANCE_TYPE_LABELS[value],
  })),
];

export default function MaintenanceListScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [typeFilter, setTypeFilter] = useState<MaintenanceType | null>(null);
  const [items, setItems] = useState<MaintenanceRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(
    async (page: number, mode: 'initial' | 'refresh' | 'append') => {
      const currentRequest = ++requestId.current;
      if (mode === 'initial') {
        setLoading(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      setError(null);

      try {
        const result = await fetchMaintenanceList({
          type: typeFilter,
          page,
          limit: PAGE_SIZE,
        });
        if (currentRequest !== requestId.current) {
          return;
        }
        setPagination(result.pagination);
        setItems((previous) =>
          mode === 'append'
            ? previous.concat(
                result.items.filter(
                  (next) => !previous.some((existing) => existing.id === next.id),
                ),
              )
            : result.items,
        );
      } catch (caught) {
        if (currentRequest === requestId.current) {
          setError(extractErrorMessage(caught));
        }
      } finally {
        if (currentRequest === requestId.current) {
          loadingMoreRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [typeFilter],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, 'initial');
    }, [loadPage]),
  );

  function handleEndReached() {
    if (!pagination || loading || refreshing || loadingMoreRef.current) {
      return;
    }
    if (pagination.page >= pagination.totalPages) {
      return;
    }
    void loadPage(pagination.page + 1, 'append');
  }

  const reachedEnd = Boolean(pagination && pagination.page >= pagination.totalPages);

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style="light" />
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
        right={
          isAdmin ? (
            <Pressable
              accessibilityLabel="Catat maintenance"
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => router.push('/maintenance/new')}
              style={({ pressed }) => [pressed ? styles.pressed : null]}
            >
              <View style={styles.addButton}>
                <Ionicons color={colors.primary} name="add" size={18} />
                <Text style={styles.addLabel}>Catat</Text>
              </View>
            </Pressable>
          ) : undefined
        }
        subtitle="Semua catatan servis aset, terbaru lebih dulu."
        title="Maintenance"
        variant="compact"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>Total catatan</Text>
            <Text style={styles.heroValue}>{pagination ? pagination.total : '—'}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons color={colors.onPrimary} name="construct-outline" size={16} />
            <Text style={styles.heroBadgeLabel}>
              {typeFilter ? MAINTENANCE_TYPE_LABELS[typeFilter] : 'Semua jenis'}
            </Text>
          </View>
        </View>
      </GradientHeader>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Jenis perawatan</Text>
        <ScrollView
          contentContainerStyle={styles.chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {TYPE_OPTIONS.map((option) => (
            <Chip
              active={typeFilter === option.value}
              key={option.label}
              label={option.label}
              onPress={() => setTypeFilter(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <ListSkeleton rows={4} />
        </View>
      ) : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateWrap}>
          <ChartCard>
            <EmptyState
              action={{ label: 'Coba lagi', onPress: () => void loadPage(1, 'initial') }}
              illustration="error"
              message={error}
              title="Gagal memuat riwayat"
            />
          </ChartCard>
        </View>
      ) : null}

      {!(error && items.length === 0) && (!loading || items.length > 0) ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          ItemSeparatorComponent={Separator}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState
              illustration={typeFilter ? 'search' : 'maintenance'}
              message={
                typeFilter
                  ? 'Tidak ada catatan dengan jenis perawatan ini.'
                  : 'Catatan perawatan akan tampil di sini setelah dibuat.'
              }
              title="Belum ada catatan maintenance"
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.footerText}>Memuat catatan berikutnya...</Text>
              </View>
            ) : items.length > 0 && reachedEnd ? (
              <Text style={styles.footerEnd}>Semua catatan sudah ditampilkan</Text>
            ) : undefined
          }
          ListHeaderComponent={
            error ? <Text style={styles.inlineError}>{error}</Text> : undefined
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void loadPage(1, 'refresh')}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <MaintenanceRow
              record={item}
              onPress={() => router.push(`/maintenance/${item.id}`)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

function MaintenanceRow({
  record,
  onPress,
}: {
  record: MaintenanceRecord;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowHeader}>
        <StatusPill
          label={MAINTENANCE_TYPE_LABELS[record.maintenanceType]}
          tone={MAINTENANCE_TYPE_TONES[record.maintenanceType]}
        />
        <Text style={styles.rowDate}>{formatDate(record.maintenanceDate)}</Text>
      </View>

      <Text numberOfLines={1} style={styles.assetName}>
        {record.asset?.assetName ?? `Aset #${record.assetId}`}
      </Text>

      <View style={styles.metaRow}>
        <Ionicons color={colors.muted} name="barcode-outline" size={13} />
        <Text numberOfLines={1} style={styles.metaText}>
          {record.asset?.assetCode ?? '-'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Ionicons color={colors.muted} name="person-outline" size={13} />
        <Text numberOfLines={1} style={styles.metaText}>
          {record.technician?.fullName ?? 'Tanpa teknisi'}
        </Text>
      </View>

      <View style={styles.resultBox}>
        <Text numberOfLines={2} style={styles.result}>
          {record.result ?? record.description ?? 'Belum ada hasil yang dicatat.'}
        </Text>
        <Ionicons color={colors.primary} name="arrow-forward" size={14} />
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  addButton: {
    ...elevation.floating,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  addLabel: {
    ...text.captionStrong,
    color: colors.primary,
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
  heroBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '52%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroBadgeLabel: {
    ...text.captionStrong,
    color: colors.onPrimary,
    flexShrink: 1,
  },
  filters: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
  },
  filterLabel: {
    ...text.label,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: layout.screenPadding,
  },
  skeletonWrap: {
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  row: {
    ...elevation.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  rowDate: {
    ...text.small,
  },
  assetName: {
    ...text.heading,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metaText: {
    ...text.small,
    color: colors.muted,
    flexShrink: 1,
  },
  metaDot: {
    ...text.small,
    color: colors.border,
  },
  resultBox: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  result: {
    ...text.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  separator: {
    height: spacing.md,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    ...text.caption,
    color: colors.muted,
  },
  footerEnd: {
    ...text.small,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  stateWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  inlineError: {
    ...text.caption,
    color: colors.dangerInk,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
