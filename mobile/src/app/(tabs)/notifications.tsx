import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage } from '../../api/client';
import { fetchNotifications } from '../../api/notifications';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import type { AppNotification, NotificationType } from '../../types/api';
import { formatDateTime } from '../../utils/format';

const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  AI_ALERT: 'warning-outline',
  MAINTENANCE_REMINDER: 'calendar-outline',
  SYSTEM: 'settings-outline',
  INFO: 'information-circle-outline',
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchNotifications();
      setItems(result.items);
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifikasi</Text>
        <Text style={styles.count}>
          {loading ? 'Memuat...' : `${items.length} notifikasi`}
        </Text>
      </View>

      {loading && items.length === 0 ? <Loading message="Memuat notifikasi..." /> : null}

      {error && items.length === 0 && !loading ? (
        <View style={styles.stateBox}>
          <Card title="Gagal memuat notifikasi">
            <Text style={styles.bodyText}>{error}</Text>
            <Button label="Coba lagi" onPress={() => void load()} style={styles.retry} />
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
              icon="notifications-outline"
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
          renderItem={({ item }) => <NotificationRow notification={item} />}
        />
      ) : null}
    </SafeAreaView>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  return (
    <View style={[styles.row, notification.isRead ? null : styles.rowUnread]}>
      <View style={styles.iconBox}>
        <Ionicons
          color={notification.isRead ? colors.muted : colors.accent}
          name={TYPE_ICONS[notification.type]}
          size={18}
        />
        {notification.isRead ? null : <View style={styles.unreadDot} />}
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={2} style={styles.rowTitle}>
          {notification.title}
        </Text>
        <Text numberOfLines={3} style={styles.rowMessage}>
          {notification.message}
        </Text>
        <Text style={styles.rowTime}>{formatDateTime(notification.createdAt)}</Text>
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
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
  listContent: {
    padding: spacing.lg,
  },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowUnread: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  rowMessage: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 2,
  },
  rowTime: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  unreadDot: {
    backgroundColor: colors.accent,
    position: 'absolute',
    borderRadius: radius.pill,
    height: 7,
    right: 3,
    top: 3,
    width: 7,
  },
  separator: {
    height: spacing.md,
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
});
