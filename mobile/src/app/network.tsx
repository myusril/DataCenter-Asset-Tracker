import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusPill } from '../components/StatusPill';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';
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

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} title="Jaringan" />

      <View style={styles.filters}>
        <View style={styles.searchBox}>
          <Ionicons color={colors.muted} name="search-outline" size={18} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Cari hostname atau alamat IP"
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

        <View style={styles.filterHeader}>
          <Text style={styles.filterLabel}>Status koneksi</Text>
          <Text style={styles.count}>
            {pagination ? `${pagination.total} perangkat` : 'Memuat...'}
          </Text>
        </View>
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

      {checkNotice ? (
        <View style={styles.notice}>
          <Ionicons color={colors.success} name="wifi" size={16} />
          <Text style={styles.noticeText}>{checkNotice}</Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? <Loading message="Memuat data jaringan..." /> : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateBox}>
          <Card title="Gagal memuat data jaringan">
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
            <NetworkRow
              checking={checkingId === item.id}
              isAdmin={isAdmin}
              onCheck={() => void handleCheck(item)}
              onPress={() => router.push(`/asset/${item.assetId}`)}
              record={item}
            />
          )}
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
            <Text style={styles.assetCode}>{record.asset.assetCode}</Text>
          </View>
          <StatusPill
            label={CONNECTION_LABELS[record.connectionStatus]}
            tone={CONNECTION_TONES[record.connectionStatus]}
          />
        </View>

        <View style={styles.addresses}>
          <Ionicons color={colors.muted} name="desktop-outline" size={14} />
          <Text style={styles.addressText}>{record.hostname ?? 'Tanpa hostname'}</Text>
          <Text style={styles.addressDot}>·</Text>
          <Text style={styles.addressText}>{record.ipAddress ?? 'Tanpa IP'}</Text>
        </View>

        <Text style={styles.checked}>
          Terakhir dicek: {formatDateTime(record.lastChecked)}
        </Text>
      </Pressable>

      {isAdmin ? (
        <View style={styles.rowActions}>
          <Pressable
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
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <>
                <Ionicons color={colors.accent} name="pulse-outline" size={16} />
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
  filters: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    paddingVertical: 0,
  },
  filterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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
  notice: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.success,
    flex: 1,
    fontSize: typography.small,
    lineHeight: 18,
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
  },
  assetName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  assetCode: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 2,
  },
  addresses: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addressText: {
    color: colors.textSecondary,
    fontSize: typography.small,
  },
  addressDot: {
    color: colors.muted,
    fontSize: typography.small,
  },
  checked: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 2,
  },
  rowActions: {
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  checkButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  checking: {
    opacity: 0.7,
  },
  checkLabel: {
    color: colors.accent,
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
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
});
