import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Sheet } from '../../components/Sheet';
import { useNotificationStore } from '../../store/notifications';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import { layout } from '../../theme/tokens';
import { text } from '../../theme/typography';
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
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Notifikasi</Text>
          <Pressable
            accessibilityLabel="Kelola notifikasi"
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => setManageOpen(true)}
            style={({ pressed }) => [styles.manageButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={colors.textSecondary} name="ellipsis-horizontal" size={20} />
          </Pressable>
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {loading && items.length === 0 ? <Loading message="Memuat notifikasi..." /> : null}

      {!loading || items.length > 0 ? (
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
          refreshControl={
            <RefreshControl
              colors={[colors.accent]}
              onRefresh={() => void load(true)}
              refreshing={refreshing}
              tintColor={colors.accent}
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
        />
      ) : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateBox}>
          <Button label="Coba lagi" onPress={() => void load()} />
        </View>
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
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.rowBody, pressed ? styles.pressed : null]}
      >
        <View
          style={[
            styles.iconBox,
            unread ? [styles.iconBoxUnread, { backgroundColor: tone.soft }] : null,
          ]}
        >
          <Ionicons
            color={unread ? tone.ink : colors.muted}
            name={TYPE_ICONS[notification.type]}
            size={18}
          />
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.typeLabel}>{TYPE_LABELS[notification.type]}</Text>
            <Text style={styles.time}>{formatNotificationTime(notification.createdAt)}</Text>
          </View>
          <Text numberOfLines={2} style={[styles.rowTitle, unread ? styles.rowTitleUnread : null]}>
            {notification.title}
          </Text>
          <Text numberOfLines={3} style={styles.rowMessage}>
            {notification.message}
          </Text>
          {notification.asset ? (
            <Text style={styles.assetLink}>
              {notification.asset.assetCode} · {notification.asset.assetName}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.rowSide}>
        {busy ? (
          <ActivityIndicator color={colors.muted} size="small" />
        ) : (
          <Pressable
            accessibilityLabel="Hapus notifikasi"
            accessibilityRole="button"
            onPress={onDelete}
            style={styles.deleteButton}
          >
            <Ionicons color={colors.muted} name="trash-outline" size={16} />
          </Pressable>
        )}
        {unread ? <View style={styles.unreadDot} /> : null}
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
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  manageButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  manageAction: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.md,
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
  notice: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  noticeText: {
    color: colors.successInk,
    fontSize: typography.small,
    lineHeight: 17,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.dangerInk,
    fontSize: typography.small,
    lineHeight: 17,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: layout.tabBarClearance,
  },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
  },
  rowUnread: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
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
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconBoxUnread: {
    backgroundColor: colors.surface,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  time: {
    color: colors.muted,
    fontSize: 11,
  },
  rowTitle: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    marginTop: 2,
  },
  rowTitleUnread: {
    color: colors.text,
    fontWeight: '700',
  },
  rowMessage: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 2,
  },
  assetLink: {
    color: colors.accent,
    fontSize: typography.small,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  rowSide: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  unreadDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  separator: {
    height: spacing.md,
  },
  stateBox: {
    padding: spacing.lg,
  },
});
