import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
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
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { Sheet } from '../../components/Sheet';
import { AssetListSkeleton } from '../../components/Skeleton';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { elevation, gradients, layout } from '../../theme/tokens';
import { fontFamily, text } from '../../theme/typography';
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
  const isAdmin = useIsAdmin();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | null>(null);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

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

  const hasFilter = Boolean(debouncedSearch || typeFilter || statusFilter);
  const activeFilterCount = (typeFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  function clearTypeStatus() {
    setTypeFilter(null);
    setStatusFilter(null);
  }

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setTypeFilter(null);
    setStatusFilter(null);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>
              Aset
            </Text>
            <Text style={styles.count}>
              {pagination
                ? hasFilter
                  ? `${pagination.total} aset cocok`
                  : `${pagination.total} aset terdaftar`
                : loading
                  ? 'Memuat...'
                  : 'Jumlah aset tidak tersedia'}
            </Text>
          </View>
          {isAdmin ? (
            <Pressable
              accessibilityLabel="Tambah aset"
              accessibilityRole="button"
              onPress={() => router.push('/asset/new')}
              style={({ pressed }) => [pressed ? styles.pressed : null]}
            >
              <LinearGradient
                colors={gradients.primaryButton}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={styles.addButton}
              >
                <Ionicons color={colors.onPrimary} name="add" size={18} />
                <Text style={styles.addLabel}>Aset</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.searchBox}>
          <Ionicons color={colors.muted} name="search-outline" size={18} />
          <TextInput
            accessibilityLabel="Cari aset"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Cari kode, nama, atau serial"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
          {search ? (
            <Pressable
              accessibilityLabel="Hapus pencarian"
              accessibilityRole="button"
              hitSlop={13}
              onPress={() => setSearch('')}
            >
              <Ionicons color={colors.muted} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          <Pressable
            accessibilityLabel={`Filter aset${activeFilterCount > 0 ? `, ${activeFilterCount} aktif` : ''}`}
            accessibilityRole="button"
            onPress={() => {
              Keyboard.dismiss();
              setFilterOpen(true);
            }}
            style={({ pressed }) => [
              styles.filterButton,
              activeFilterCount > 0 ? styles.filterButtonActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              color={activeFilterCount > 0 ? colors.primary : colors.textSecondary}
              name="options-outline"
              size={17}
            />
            <Text
              style={[
                styles.filterButtonLabel,
                activeFilterCount > 0 ? styles.filterButtonLabelActive : null,
              ]}
            >
              Filter
            </Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountLabel}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>

          {activeFilterCount > 0 ? (
            <ScrollView
              contentContainerStyle={styles.activeFilters}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.activeFiltersScroll}
            >
              {typeFilter ? (
                <ActiveFilter
                  label={ASSET_TYPE_LABELS[typeFilter]}
                  onRemove={() => setTypeFilter(null)}
                />
              ) : null}
              {statusFilter ? (
                <ActiveFilter
                  label={ASSET_STATUS_LABELS[statusFilter]}
                  onRemove={() => setStatusFilter(null)}
                />
              ) : null}
            </ScrollView>
          ) : (
            <Text numberOfLines={1} style={styles.filterHint}>
              Semua tipe dan status
            </Text>
          )}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <AssetListSkeleton />
        </View>
      ) : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateWrap}>
          <Card>
            <EmptyState
              action={{ label: 'Coba lagi', onPress: () => void loadPage(1, 'initial') }}
              illustration="error"
              message={error}
              title="Gagal memuat aset"
            />
          </Card>
        </View>
      ) : null}

      {!(error && items.length === 0) && (!loading || items.length > 0) ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          ItemSeparatorComponent={Separator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState
              action={hasFilter ? { label: 'Reset filter', onPress: resetFilters } : undefined}
              illustration={hasFilter ? 'search' : 'assets'}
              message={
                hasFilter
                  ? 'Coba ubah kata kunci atau filter yang dipilih.'
                  : 'Belum ada aset yang tercatat di server.'
              }
              title={hasFilter ? 'Aset tidak ditemukan' : 'Belum ada aset'}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.footerText}>Memuat aset berikutnya...</Text>
              </View>
            ) : items.length > 0 ? (
              <Text style={styles.footerEnd}>Semua aset sudah ditampilkan</Text>
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
            <AssetCard asset={item} onPress={() => router.push(`/asset/${item.id}`)} />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : null}

      <Sheet
        onClose={() => setFilterOpen(false)}
        subtitle="Tipe dan status langsung diterapkan ke daftar."
        title="Filter aset"
        visible={filterOpen}
      >
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Tipe aset</Text>
          <View style={styles.chipWrap}>
            {TYPE_OPTIONS.map((option) => (
              <Chip
                active={typeFilter === option.value}
                key={`type-${option.label}`}
                label={option.label}
                onPress={() => setTypeFilter(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Status aset</Text>
          <View style={styles.chipWrap}>
            {STATUS_OPTIONS.map((option) => (
              <Chip
                active={statusFilter === option.value}
                key={`status-${option.label}`}
                label={option.label}
                onPress={() => setStatusFilter(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetActions}>
          <Button
            disabled={activeFilterCount === 0}
            label="Reset"
            onPress={clearTypeStatus}
            style={styles.sheetButton}
            variant="secondary"
          />
          <Button
            label="Selesai"
            onPress={() => setFilterOpen(false)}
            style={styles.sheetButton}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Hapus filter ${label}`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onRemove}
      style={({ pressed }) => [styles.activeFilter, pressed ? styles.pressed : null]}
    >
      <Text style={styles.activeFilterLabel}>{label}</Text>
      <Ionicons color={colors.primary} name="close-circle" size={16} />
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
  header: {
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleBlock: {
    gap: 2,
  },
  title: {
    ...text.display,
    fontSize: 26,
    lineHeight: 32,
  },
  count: {
    ...text.caption,
    color: colors.muted,
  },
  addButton: {
    ...elevation.card,
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  addLabel: {
    ...text.captionStrong,
    color: colors.onPrimary,
    fontFamily: fontFamily.bold,
  },
  searchBox: {
    ...elevation.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...text.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.md,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  filterButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.primary,
  },
  filterButtonLabel: {
    ...text.captionStrong,
    color: colors.textSecondary,
  },
  filterButtonLabelActive: {
    color: colors.primary,
  },
  filterCount: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
  },
  filterCountLabel: {
    ...text.small,
    color: colors.onPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 10,
    lineHeight: 14,
  },
  activeFiltersScroll: {
    flex: 1,
  },
  activeFilters: {
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  activeFilter: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  activeFilterLabel: {
    ...text.captionStrong,
    color: colors.primary,
  },
  filterHint: {
    ...text.caption,
    color: colors.muted,
    flex: 1,
  },
  filterSection: {
    gap: spacing.sm,
  },
  filterSectionTitle: {
    ...text.captionStrong,
    color: colors.text,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sheetButton: {
    flex: 1,
  },
  skeletonWrap: {
    paddingTop: spacing.lg,
  },
  stateWrap: {
    padding: spacing.lg,
  },
  listContent: {
    paddingBottom: layout.tabBarClearance,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
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
    color: colors.muted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
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
