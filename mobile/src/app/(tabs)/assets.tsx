import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchAssets } from '../../api/assets';
import { extractErrorMessage } from '../../api/client';
import { AssetCard } from '../../components/AssetCard';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import type { Asset, AssetStatus, AssetType, Pagination } from '../../types/api';
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from '../../utils/format';

const PAGE_SIZE = 6;

const TYPE_OPTIONS: Array<{ value: AssetType | null; label: string }> = [
  { value: null, label: 'Semua' },
  ...(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((value) => ({
    value,
    label: ASSET_TYPE_LABELS[value],
  })),
];

const STATUS_OPTIONS: Array<{ value: AssetStatus | null; label: string }> = [
  { value: null, label: 'Semua' },
  ...(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((value) => ({
    value,
    label: ASSET_STATUS_LABELS[value],
  })),
];

export default function AssetsScreen() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | null>(null);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | null>(null);

  const [items, setItems] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

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
        const result = await fetchAssets({
          search: debouncedSearch,
          type: typeFilter,
          status: statusFilter,
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
          // Reset the append lock even when an append was superseded by a new
          // filter/search request, otherwise pagination stays disabled.
          loadingMoreRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedSearch, typeFilter, statusFilter],
  );

  useEffect(() => {
    setItems([]);
    setPagination(null);
    void loadPage(1, 'initial');
  }, [loadPage]);

  function handleEndReached() {
    if (!pagination || loading || refreshing || loadingMoreRef.current) {
      return;
    }
    if (pagination.page >= pagination.totalPages) {
      return;
    }
    void loadPage(pagination.page + 1, 'append');
  }

  const hasFilter = Boolean(debouncedSearch || typeFilter || statusFilter);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Aset</Text>
          <Text style={styles.count}>
            {pagination ? `${pagination.total} aset` : 'Memuat...'}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons color={colors.muted} name="search-outline" size={18} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Cari kode, nama, atau serial number"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={search}
          />
          {search ? (
            <Pressable accessibilityRole="button" onPress={() => setSearch('')}>
              <Ionicons color={colors.muted} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.filterLabel}>Tipe</Text>
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

        <Text style={styles.filterLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((option) => (
              <Chip
                active={statusFilter === option.value}
                key={option.label}
                label={option.label}
                onPress={() => setStatusFilter(option.value)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {loading && items.length === 0 ? <Loading message="Memuat aset..." /> : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.listState}>
          <Card title="Gagal memuat aset">
            <Text style={styles.errorText}>{error}</Text>
            <Button
              label="Coba lagi"
              onPress={() => void loadPage(1, 'initial')}
              style={styles.retry}
            />
          </Card>
        </View>
      ) : null}

      {!(error && items.length === 0) && (!loading || items.length > 0) ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              message={
                hasFilter
                  ? 'Coba ubah kata kunci atau filter yang dipilih.'
                  : 'Belum ada aset yang tercatat di server.'
              }
              title="Tidak ada aset"
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : undefined
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
            <AssetCard asset={item} onPress={() => router.push(`/asset/${item.id}`)} />
          )}
        />
      ) : null}
    </SafeAreaView>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  count: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 44,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    paddingVertical: 0,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  listState: {
    padding: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  footer: {
    marginVertical: spacing.lg,
  },
  errorText: {
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
});
