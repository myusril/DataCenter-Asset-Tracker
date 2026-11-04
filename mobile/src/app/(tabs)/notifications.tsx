import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage } from '../../api/client';
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications';
import { Button } from '../../components/Button';
import { ChartCard } from '../../components/ChartCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { GradientHeader } from '../../components/GradientHeader';
import { IconButton } from '../../components/IconButton';
import { Sheet } from '../../components/Sheet';
import { NotificationListSkeleton } from '../../components/Skeleton';
import { useNotificationStore } from '../../store/notifications';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { elevation, layout } from '../../theme/tokens';
import { fontFamily, text } from '../../theme/typography';
import type { AppNotification, NotificationType } from '../../types/api';
import { formatNotificationTime } from '../../utils/format';

const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  AI_ALERT: 'warning-outline',
  MAINTENANCE_REMINDER: 'calendar-outline',
  SYSTEM: 'settings-outline',
  INFO: 'information-circle-outline',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  AI_ALERT: 'Peringatan AI',
  MAINTENANCE_REMINDER: 'Pengingat maintenance',
  SYSTEM: 'Sistem',
  INFO: 'Informasi',
};

const TYPE_TONES: Record<NotificationType, { ink: string; soft: string }> = {
  AI_ALERT: { ink: colors.dangerInk, soft: colors.dangerSoft },
  MAINTENANCE_REMINDER: { ink: colors.warningInk, soft: colors.warningSoft },
  SYSTEM: { ink: colors.textSecondary, soft: colors.mutedSurface },
  INFO: { ink: colors.primary, soft: colors.accentSoft },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const refreshUnread = useNotificationStore((state) => state.refreshUnread);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'read-all' | 'delete-read' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmDeleteRead, setConfirmDeleteRead] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await fetchNotifications({ page: 1, limit: 50 });
        setItems(result.items);
        await refreshUnread();
      } catch (caught) {
        setError(extractErrorMessage(caught));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshUnread],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleTap(notification: AppNotification) {
    if (!notification.isRead) {
      setBusyId(notification.id);
      try {
        const updated = await markNotificationRead(notification.id);
        setItems((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
        await refreshUnread();
      } catch (caught) {
        setError(extractErrorMessage(caught));
      } finally {
        setBusyId(null);
      }
    }

    if (notification.maintenanceId !== null) {
      router.push(`/maintenance/${notification.maintenanceId}`);
      return;
    }

    if (notification.assetId !== null) {
      // The maintenance row was deleted (SetNull), so fall back to the asset's
      // Maintenance tab instead of a dead detail page.
      router.push(
        notification.type === 'MAINTENANCE_REMINDER'
          ? `/asset/${notification.assetId}?tab=maintenance`
          : `/asset/${notification.assetId}`,
      );
    }
  }

  async function handleDelete(notification: AppNotification) {
    setBusyId(notification.id);
    setError(null);
    try {
      await deleteNotification(notification.id);
      setItems((previous) => previous.filter((item) => item.id !== notification.id));
      setNotice('Notifikasi dihapus.');
      await refreshUnread();
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAll() {
    setBulkBusy('read-all');
    setError(null);
    setNotice(null);
    try {
      const updated = await markAllNotificationsRead();
      setNotice(`${updated} notifikasi ditandai sudah dibaca.`);
      setManageOpen(false);
      await load();
    } catch (caught) {
      setError(extractErrorMessage(caught));
      setManageOpen(false);
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleDeleteRead() {
    setBulkBusy('delete-read');
    setError(null);
    setNotice(null);
    try {
      const deleted = await deleteReadNotifications();
      setNotice(`${deleted} notifikasi yang sudah dibaca dihapus.`);
      setConfirmDeleteRead(false);
      await load();
    } catch (caught) {
      setError(extractErrorMessage(caught));
      setConfirmDeleteRead(false);
    } finally {
      setBulkBusy(null);
    }
  }

  const sortedItems = [...items].sort(
    (first, second) => Number(first.isRead) - Number(second.isRead),
  );
  const readCount = items.filter((item) => item.isRead).length;

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style="light" />
      <GradientHeader
        right={
          <IconButton
            accessibilityLabel="Kelola notifikasi"
            icon="ellipsis-horizontal"
            onPress={() => setManageOpen(true)}
            tone="glass"
          />
        }
        subtitle="Peringatan risiko, pengingat maintenance, dan informasi sistem."
        title="Notifikasi"
      >
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{unreadCount}</Text>
            <Text style={styles.heroLabel}>Belum dibaca</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{readCount}</Text>
            <Text style={styles.heroLabel}>Sudah dibaca</Text>
          </View>
        </View>
      </GradientHeader>

      {notice ? (
        <View accessibilityLiveRegion="polite" style={styles.notice}>
          <Ionicons color={colors.successInk} name="checkmark-circle" size={16} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Ionicons color={colors.dangerInk} name="alert-circle" size={16} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <NotificationListSkeleton />
        </View>
      ) : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateWrap}>
          <ChartCard>
            <EmptyState
              action={{ label: 'Coba lagi', onPress: () => void load() }}
              illustration="error"
              message={error}
              title="Gagal memuat notifikasi"
            />
          </ChartCard>
        </View>
      ) : null}

      {!(error && items.length === 0) && (!loading || items.length > 0) ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={sortedItems}
          ItemSeparatorComponent={Separator}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState
              illustration="notifications"
              message="Peringatan risiko dan informasi sistem akan tampil di sini."
              title="Belum ada notifikasi"
            />
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={styles.captionRow}>
                <View style={styles.captionPill}>
                  <Ionicons color={colors.textSecondary} name="time-outline" size={13} />
                  <Text style={styles.listCaption}>
                    Menampilkan {items.length} notifikasi terbaru
                  </Text>
                </View>
              </View>
            ) : undefined
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
            <NotificationRow
              busy={busyId === item.id}
              notification={item}
              onDelete={() => void handleDelete(item)}
              onPress={() => void handleTap(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : null}

      <Sheet
        onClose={() => setManageOpen(false)}
        subtitle={`${unreadCount} belum dibaca · ${readCount} sudah dibaca di daftar ini`}
        title="Kelola notifikasi"
        visible={manageOpen}
      >
        <ManageAction
          busy={bulkBusy === 'read-all'}
          description="Semua notifikasi di server ditandai sudah dibaca."
          disabled={unreadCount === 0 || bulkBusy !== null}
          icon="checkmark-done-outline"
          onPress={() => void handleMarkAll()}
          title="Tandai semua dibaca"
        />
        <ManageAction
          busy={bulkBusy === 'delete-read'}
          description="Menghapus permanen notifikasi yang sudah dibaca."
          disabled={readCount === 0 || bulkBusy !== null}
          icon="trash-outline"
          onPress={() => {
            setManageOpen(false);
            setConfirmDeleteRead(true);
          }}
          title="Hapus yang sudah dibaca"
          tone="danger"
        />
        <Button label="Tutup" onPress={() => setManageOpen(false)} variant="secondary" />
      </Sheet>

      <ConfirmDialog
        busy={bulkBusy === 'delete-read'}
        confirmLabel="Hapus"
        message="Semua notifikasi yang sudah dibaca akan dihapus permanen. Notifikasi yang belum dibaca tidak tersentuh."
        onCancel={() => {
          if (bulkBusy === null) {
            setConfirmDeleteRead(false);
          }
        }}
        onConfirm={() => void handleDeleteRead()}
        title="Hapus notifikasi terbaca?"
        visible={confirmDeleteRead}
      />
    </SafeAreaView>
  );
}

function ManageAction({
  icon,
  title,
  description,
  tone = 'primary',
  disabled,
  busy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  tone?: 'primary' | 'danger';
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const ink = tone === 'danger' ? colors.dangerInk : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.manageAction,
        disabled ? styles.manageActionDisabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.manageIcon, tone === 'danger' ? styles.manageIconDanger : null]}>
        {busy ? (
          <ActivityIndicator color={ink} size="small" />
        ) : (
          <Ionicons color={ink} name={icon} size={20} />
        )}
      </View>
      <View style={styles.manageText}>
        <Text style={[styles.manageTitle, tone === 'danger' ? styles.manageTitleDanger : null]}>
          {title}
        </Text>
        <Text style={styles.manageDescription}>{description}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={16} />
    </Pressable>
  );
}

function NotificationRow({
  notification,
  busy,
  onPress,
  onDelete,
}: {
  notification: AppNotification;
  busy: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const unread = !notification.isRead;
  const tone = TYPE_TONES[notification.type];

  return (
    <View style={[styles.row, unread ? styles.rowUnread : null]}>
      {unread ? <View pointerEvents="none" style={styles.unreadRail} /> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.rowBody, pressed ? styles.pressed : null]}
      >
        <View style={[styles.iconBox, { backgroundColor: tone.soft }]}>
          <Ionicons color={tone.ink} name={TYPE_ICONS[notification.type]} size={18} />
        </View>

        <View style={styles.rowContent}>
          <Text numberOfLines={1} style={[styles.typeLabel, { color: tone.ink }]}>
            {TYPE_LABELS[notification.type]}
          </Text>
          <Text numberOfLines={2} style={[styles.rowTitle, unread ? styles.rowTitleUnread : null]}>
            {notification.title}
          </Text>
          <Text numberOfLines={3} style={styles.rowMessage}>
            {notification.message}
          </Text>
          {notification.asset ? (
            <View style={styles.assetChip}>
              <Ionicons color={colors.primary} name="cube-outline" size={12} />
              <Text numberOfLines={1} style={styles.assetLink}>
                {notification.asset.assetCode} · {notification.asset.assetName}
              </Text>
            </View>
          ) : null}
          <Text numberOfLines={1} style={styles.time}>
            {formatNotificationTime(notification.createdAt)}
          </Text>
        </View>
      </Pressable>

      <View style={styles.rowSide}>
        {busy ? (
          <ActivityIndicator color={colors.muted} size="small" />
        ) : (
          <IconButton
            accessibilityLabel="Hapus notifikasi"
            icon="trash-outline"
            onPress={onDelete}
            size="sm"
            tone="soft"
          />
        )}
      </View>
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
  heroRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.lg,
  },
  heroStat: {
    flex: 1,
    gap: 2,
  },
  heroDivider: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    height: 36,
    width: 1,
  },
  heroValue: {
    ...text.metricLarge,
    color: colors.onPrimary,
    textAlign: 'center',
  },
  heroLabel: {
    ...text.small,
    color: colors.onPrimaryMuted,
    textAlign: 'center',
  },
  captionRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  captionPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  listCaption: {
    ...text.small,
    color: colors.textSecondary,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  noticeText: {
    ...text.caption,
    color: colors.successInk,
    flex: 1,
  },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  errorText: {
    ...text.caption,
    color: colors.dangerInk,
    flex: 1,
  },
  manageAction: {
    ...elevation.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  manageActionDisabled: {
    opacity: 0.5,
  },
  manageIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  manageIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  manageText: {
    flex: 1,
    gap: 2,
  },
  manageTitle: {
    ...text.bodyStrong,
  },
  manageTitleDanger: {
    color: colors.dangerInk,
  },
  manageDescription: {
    ...text.small,
    color: colors.muted,
  },
  skeletonWrap: {
    paddingTop: spacing.lg,
  },
  stateWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },
  listContent: {
    paddingBottom: layout.tabBarClearance,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
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
  rowUnread: {
    borderColor: colors.primary,
  },
  unreadRail: {
    backgroundColor: colors.primary,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  typeLabel: {
    ...text.small,
    fontFamily: fontFamily.bold,
  },
  time: {
    ...text.small,
    marginTop: spacing.xs,
  },
  rowTitle: {
    ...text.captionStrong,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowTitleUnread: {
    color: colors.text,
    fontFamily: fontFamily.bold,
  },
  rowMessage: {
    ...text.small,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  assetChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  assetLink: {
    ...text.small,
    color: colors.primary,
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
  },
  rowSide: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
