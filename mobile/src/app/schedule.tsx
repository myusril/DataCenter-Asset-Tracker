import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage } from '../api/client';
import {
  fetchMaintenanceSchedule,
  runMaintenanceReminders,
} from '../api/maintenance';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatusPill } from '../components/StatusPill';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { layout } from '../theme/tokens';
import { text } from '../theme/typography';
import type {
  MaintenanceSchedule,
  MaintenanceScheduleItem,
  ScheduleState,
} from '../types/api';
import {
  formatDate,
  MAINTENANCE_TYPE_LABELS,
} from '../utils/format';

type FilterKey = 'overdue' | 'week' | 'month';

const STATE_META: Record<ScheduleState, { label: string; tone: 'danger' | 'warning' | 'accent' }> = {
  OVERDUE: { label: 'Terlewat', tone: 'danger' },
  DUE_SOON: { label: '≤ 7 hari', tone: 'warning' },
  UPCOMING: { label: 'Akan datang', tone: 'accent' },
};

const EMPTY_COPY: Record<FilterKey, { title: string; message: string }> = {
  overdue: {
    title: 'Tidak ada jadwal terlewat',
    message: 'Semua jadwal maintenance tercatat masih dalam tenggat.',
  },
  week: {
    title: 'Tidak ada jadwal dalam 7 hari',
    message: 'Jadwal terdekat akan muncul di sini saat mendekati tenggat.',
  },
  month: {
    title: 'Belum ada jadwal 30 hari ke depan',
    message: 'Isi "jadwal berikutnya" saat mencatat maintenance agar muncul di sini.',
  },
};

function timingLabel(daysUntil: number): string {
  if (daysUntil < 0) {
    return `Terlewat ${Math.abs(daysUntil)} hari`;
  }
  if (daysUntil === 0) {
    return 'Jatuh tempo hari ini';
  }
  return `Dalam ${daysUntil} hari`;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [filter, setFilter] = useState<FilterKey>('overdue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
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
      const result = await fetchMaintenanceSchedule({ window: 30, includeOverdue: true });
      if (currentRequest === requestId.current) {
        setSchedule(result);
      }
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

  async function handleRunReminders() {
    if (running) {
      return;
    }
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runMaintenanceReminders();
      setNotice(
        result.created > 0
          ? `${result.created} pengingat baru dibuat untuk ${result.scanned} jadwal; ${result.skipped} sudah pernah dikirim.`
          : `Tidak ada pengingat baru. ${result.scanned} jadwal dipindai, ${result.skipped} sudah pernah dikirim.`,
      );
      setConfirmOpen(false);
    } catch (caught) {
      setError(extractErrorMessage(caught));
      setConfirmOpen(false);
    } finally {
      setRunning(false);
    }
  }

  const items = schedule?.items ?? [];
  const overdue = items.filter((item) => item.state === 'OVERDUE');
  const dueSoon = items.filter((item) => item.state === 'DUE_SOON');
  const upcoming = items.filter((item) => item.state === 'UPCOMING');
  const counts: Record<FilterKey, number> = {
    overdue: overdue.length,
    week: dueSoon.length,
    month: dueSoon.length + upcoming.length,
  };
  const visible = filter === 'overdue' ? overdue : filter === 'week' ? dueSoon : [...dueSoon, ...upcoming];

  const tabs = [
    { key: 'overdue' as const, label: `Terlewat (${counts.overdue})` },
    { key: 'week' as const, label: `7 hari (${counts.week})` },
    { key: 'month' as const, label: `30 hari (${counts.month})` },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} title="Jadwal Maintenance" />

      {isAdmin ? (
        <View style={styles.adminBox}>
          <Card title="Pengingat otomatis">
            <Text style={styles.bodyText}>
              Buat notifikasi untuk jadwal yang terlewat atau jatuh tempo dalam 7 hari. Setiap pengguna
              aktif menerima paling banyak satu pengingat per jadwal.
            </Text>
            <Button
              icon="notifications-outline"
              label="Jalankan pengingat"
              loading={running}
              onPress={() => setConfirmOpen(true)}
              variant="secondary"
            />
          </Card>
        </View>
      ) : null}

      <View style={styles.filters}>
        <SegmentedTabs
          accessibilityLabel="Rentang jadwal maintenance"
          active={filter}
          items={tabs}
          onChange={setFilter}
        />
        <View style={styles.filterMeta}>
          <Text style={styles.filterMetaText}>
            {schedule ? `${visible.length} jadwal ditampilkan` : 'Memuat...'}
          </Text>
          {schedule ? (
            <Text style={styles.filterMetaText}>Hari ini {formatDate(schedule.today)}</Text>
          ) : null}
        </View>
      </View>

      {notice ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      {error && schedule ? <Text style={styles.inlineError}>{error}</Text> : null}

      {loading && !schedule ? <Loading message="Memuat jadwal maintenance..." /> : null}

      {error && !schedule && !loading ? (
        <View style={styles.stateBox}>
          <Card title="Gagal memuat jadwal">
            <Text style={styles.bodyText}>{error}</Text>
            <Button label="Coba lagi" onPress={() => void load()} style={styles.retry} />
          </Card>
        </View>
      ) : null}

      {schedule && !(error && !schedule) ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={visible}
          ItemSeparatorComponent={Separator}
          keyExtractor={(item) => String(item.maintenanceId)}
          ListEmptyComponent={
            <EmptyState
              illustration="maintenance"
              message={EMPTY_COPY[filter].message}
              title={EMPTY_COPY[filter].title}
            />
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void load(true)}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <ScheduleRow
              item={item}
              onPress={() => router.push(`/maintenance/${item.maintenanceId}`)}
            />
          )}
        />
      ) : null}

      <ConfirmDialog
        busy={running}
        confirmLabel="Jalankan"
        message="Pengingat dibuat untuk semua pengguna aktif pada jadwal yang terlewat atau jatuh tempo dalam 7 hari. Pengingat yang sudah ada tidak diduplikasi."
        onCancel={() => {
          if (!running) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleRunReminders()}
        title="Jalankan pengingat maintenance?"
        visible={confirmOpen}
      />
    </SafeAreaView>
  );
}

function ScheduleRow({
  item,
  onPress,
}: {
  item: MaintenanceScheduleItem;
  onPress: () => void;
}) {
  const meta = STATE_META[item.state];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowHeader}>
        <StatusPill label={meta.label} tone={meta.tone} />
        <Text style={styles.rowDate}>{formatDate(item.nextSchedule)}</Text>
      </View>

      <Text numberOfLines={1} style={styles.assetName}>
        {item.asset.assetName}
      </Text>
      <Text style={styles.assetCode}>
        {item.asset.assetCode} · {MAINTENANCE_TYPE_LABELS[item.maintenanceType]}
      </Text>

      <View style={styles.timingRow}>
        <Ionicons
          color={item.state === 'OVERDUE' ? colors.dangerInk : colors.textSecondary}
          name="time-outline"
          size={14}
        />
        <Text
          style={[
            styles.timingText,
            item.state === 'OVERDUE' ? styles.timingTextOverdue : null,
          ]}
        >
          {timingLabel(item.daysUntil)}
        </Text>
      </View>

      <View style={styles.rowFooter}>
        <Text numberOfLines={2} style={styles.lastResult}>
          {item.lastResult?.trim() || 'Belum ada hasil perawatan yang dicatat.'}
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
  adminBox: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterMetaText: {
    ...text.small,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.tabBarClearance,
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
    ...text.small,
  },
  assetName: {
    ...text.bodyStrong,
  },
  assetCode: {
    ...text.small,
  },
  timingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timingText: {
    ...text.small,
  },
  timingTextOverdue: {
    color: colors.dangerInk,
  },
  rowFooter: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  lastResult: {
    ...text.small,
    flex: 1,
    lineHeight: 17,
  },
  separator: {
    height: spacing.md,
  },
  stateBox: {
    padding: spacing.lg,
  },
  bodyText: {
    ...text.caption,
  },
  retry: {
    marginTop: spacing.md,
  },
  inlineError: {
    ...text.small,
    color: colors.dangerInk,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  noticeBox: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.sm,
  },
  noticeText: {
    ...text.small,
    color: colors.successInk,
  },
});
