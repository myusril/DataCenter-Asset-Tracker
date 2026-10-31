import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { Loading } from '../components/Loading';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusPill } from '../components/StatusPill';
import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';
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

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader
        onBack={() => router.back()}
        right={
          isAdmin ? (
            <Pressable
              accessibilityLabel="Catat maintenance"
              accessibilityRole="button"
              onPress={() => router.push('/maintenance/new')}
              style={styles.headerAction}
            >
              <Ionicons color={colors.accent} name="add-circle-outline" size={24} />
            </Pressable>
          ) : undefined
        }
        title="Maintenance"
      />

      <View style={styles.filters}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterLabel}>Jenis perawatan</Text>
          <Text style={styles.count}>
            {pagination ? `${pagination.total} catatan` : 'Memuat...'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((option) => (
              <Chip
                active={typeFilter === option.value}
                key={option.label}
                label={option.label}
                onPress={() => setTypeFilter(option.value)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {loading && items.length === 0 ? <Loading message="Memuat riwayat..." /> : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateBox}>
          <Card title="Gagal memuat riwayat">
            <Text style={styles.bodyText}>{error}</Text>
            <Button label="Coba lagi" onPress={() => void loadPage(1, 'initial')} style={styles.retry} />
          </Card>
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
              icon="construct-outline"
              message={
                typeFilter
                  ? 'Tidak ada catatan dengan jenis perawatan ini.'
                  : 'Catatan perawatan akan tampil di sini setelah dibuat.'
              }
              title="Belum ada catatan maintenance"
            />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footer} /> : undefined
          }
          ListHeaderComponent={
            error ? <Text style={styles.inlineError}>{error}</Text> : undefined
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              colors={[colors.accent]}
              onRefresh={() => void loadPage(1, 'refresh')}
              refreshing={refreshing}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <MaintenanceRow
              record={item}
              onPress={() => router.push(`/maintenance/${item.id}`)}
            />
          )}
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
      <Text style={styles.assetCode}>
        {record.asset?.assetCode ?? '-'} · {record.technician?.fullName ?? 'Tanpa teknisi'}
      </Text>

      <View style={styles.rowFooter}>
        <Text numberOfLines={2} style={styles.result}>
          {record.result ?? record.description ?? 'Belum ada hasil yang dicatat.'}
        </Text>
        <Ionicons color={colors.muted} name="chevron-forward" size={16} />
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
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  count: {
    color: colors.muted,
    fontSize: typography.small,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
  },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  rowDate: {
    color: colors.muted,
    fontSize: typography.small,
  },
  assetName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  assetCode: {
    color: colors.muted,
    fontSize: typography.small,
  },
  rowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  result: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: typography.small,
    lineHeight: 18,
  },
  separator: {
    height: spacing.md,
  },
  footer: {
    marginVertical: spacing.lg,
  },
  stateBox: {
    padding: spacing.lg,
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
    marginBottom: spacing.md,
  },
  headerAction: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
