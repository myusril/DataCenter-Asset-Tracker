import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

import { extractErrorMessage } from '../api/client';
import { checkNetworkConnection, fetchNetworkList } from '../api/network';
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
  ConnectionStatus,
  NetworkRecord,
  Pagination,
} from '../types/api';
import { CONNECTION_LABELS, formatDateTime } from '../utils/format';
import { CONNECTION_TONES } from '../utils/pills';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ value: ConnectionStatus | null; label: string }> = [
  { value: null, label: 'Semua' },
  ...(Object.keys(CONNECTION_LABELS) as ConnectionStatus[]).map((value) => ({
    value,
    label: CONNECTION_LABELS[value],
  })),
];

export default function NetworkListScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConnectionStatus | null>(null);

  const [items, setItems] = useState<NetworkRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [checkNotice, setCheckNotice] = useState<string | null>(null);

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
        const result = await fetchNetworkList({
          search: debouncedSearch,
          connectionStatus: statusFilter,
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
    [debouncedSearch, statusFilter],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, 'initial');
    }, [loadPage]),
  );

  async function handleCheck(record: NetworkRecord) {
    if (checkingId !== null) {
      return;
    }
    setCheckingId(record.id);
    setCheckNotice(null);
    try {
      const updated = await checkNetworkConnection(record.id);
      setItems((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
      setCheckNotice(
        `${updated.asset.assetCode} (${updated.hostname ?? 'tanpa hostname'}) diperiksa: ${
          CONNECTION_LABELS[updated.connectionStatus]
        }.`,
      );
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setCheckingId(null);
    }
  }

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
        eyebrow="Pemantauan data center"
        left={
          <IconButton
            accessibilityLabel="Kembali"
            icon="arrow-back"
            onPress={() => router.back()}
            tone="glass"
          />
        }
        subtitle="Status koneksi terkini setiap perangkat."
        title="Jaringan"
        variant="compact"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>Total perangkat</Text>
            <Text style={styles.heroValue}>{pagination ? pagination.total : '—'}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons color={colors.onPrimary} name="funnel-outline" size={15} />
            <Text style={styles.heroBadgeLabel}>
              {statusFilter ? CONNECTION_LABELS[statusFilter] : 'Semua status'}
            </Text>
          </View>
        </View>
      </GradientHeader>

      <View style={styles.filters}>
        <View style={styles.searchBox}>
          <Ionicons color={colors.muted} name="search-outline" size={18} />
          <TextInput
            accessibilityLabel="Cari perangkat jaringan"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Cari hostname atau alamat IP"
            placeholderTextColor={colors.placeholder}
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

        <Text style={styles.filterLabel}>Status koneksi</Text>
        <ScrollView
          contentContainerStyle={styles.chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {STATUS_OPTIONS.map((option) => (
            <Chip
              active={statusFilter === option.value}
              key={option.label}
              label={option.label}
              onPress={() => setStatusFilter(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {checkNotice ? (
        <View accessibilityLiveRegion="polite" style={styles.notice}>
          <Ionicons color={colors.successInk} name="wifi" size={16} />
          <Text style={styles.noticeText}>{checkNotice}</Text>
        </View>
      ) : null}

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
              title="Gagal memuat data jaringan"
            />
          </ChartCard>
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
              illustration="network"
              message="Coba ubah kata kunci atau status yang dipilih."
              title="Tidak ada data jaringan"
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.footerText}>Memuat perangkat berikutnya...</Text>
              </View>
            ) : items.length > 0 && reachedEnd ? (
              <Text style={styles.footerEnd}>Semua perangkat sudah ditampilkan</Text>
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
            <NetworkRow
              checking={checkingId === item.id}
              isAdmin={isAdmin}
              onCheck={() => void handleCheck(item)}
              onPress={() => router.push(`/asset/${item.assetId}`)}
              record={item}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

function NetworkRow({
  record,
  isAdmin,
  checking,
  onPress,
  onCheck,
}: {
  record: NetworkRecord;
  isAdmin: boolean;
  checking: boolean;
  onPress: () => void;
  onCheck: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.rowBody, pressed ? styles.pressed : null]}
      >
        <View style={styles.rowTop}>
          <View style={styles.rowTitleBlock}>
            <Text numberOfLines={1} style={styles.assetName}>
              {record.asset.assetName}
            </Text>
            <View style={styles.codeRow}>
              <Ionicons color={colors.muted} name="barcode-outline" size={13} />
              <Text numberOfLines={1} style={styles.assetCode}>
                {record.asset.assetCode}
              </Text>
            </View>
          </View>
          <StatusPill
            label={CONNECTION_LABELS[record.connectionStatus]}
            tone={CONNECTION_TONES[record.connectionStatus]}
          />
        </View>

        <View style={styles.addresses}>
          <Ionicons color={colors.textSecondary} name="desktop-outline" size={14} />
          <Text numberOfLines={1} style={styles.addressText}>
            {record.hostname ?? 'Tanpa hostname'}
          </Text>
          <Text style={styles.addressDot}>·</Text>
          <Text numberOfLines={1} style={styles.addressText}>
            {record.ipAddress ?? 'Tanpa IP'}
          </Text>
        </View>

        <View style={styles.checkedRow}>
          <Ionicons color={colors.muted} name="time-outline" size={12} />
          <Text style={styles.checked}>Terakhir dicek: {formatDateTime(record.lastChecked)}</Text>
        </View>
      </Pressable>

      {isAdmin ? (
        <View style={styles.rowActions}>
          <Pressable
            accessibilityLabel={`Cek koneksi ${record.asset.assetCode}`}
            accessibilityRole="button"
            accessibilityState={{ busy: checking, disabled: checking }}
            disabled={checking}
            onPress={onCheck}
            style={({ pressed }) => [
              styles.checkButton,
              pressed ? styles.pressed : null,
              checking ? styles.checking : null,
            ]}
          >
            {checking ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons color={colors.primary} name="pulse-outline" size={16} />
                <Text style={styles.checkLabel}>Cek</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
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
    paddingBottom: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
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
  filterLabel: {
    ...text.label,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: layout.screenPadding,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  noticeText: {
    ...text.caption,
    color: colors.successInk,
    flex: 1,
  },
  skeletonWrap: {
    paddingTop: spacing.md,
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
    flexDirection: 'row',
    overflow: 'hidden',
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  rowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowTitleBlock: {
    flex: 1,
    gap: 3,
  },
  assetName: {
    ...text.heading,
  },
  codeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  assetCode: {
    ...text.small,
    color: colors.muted,
    flexShrink: 1,
  },
  addresses: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addressText: {
    ...text.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  addressDot: {
    ...text.caption,
    color: colors.border,
  },
  checkedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  checked: {
    ...text.small,
    color: colors.muted,
  },
  rowActions: {
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  checkButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  checking: {
    opacity: 0.7,
  },
  checkLabel: {
    ...text.captionStrong,
    color: colors.primary,
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
    paddingTop: spacing.md,
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
