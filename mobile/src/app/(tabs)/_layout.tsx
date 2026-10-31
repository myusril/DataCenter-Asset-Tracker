import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '../../store/auth';
import { useNotificationStore } from '../../store/notifications';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/spacing';

export default function TabsLayout() {
  const token = useAuthStore((state) => state.token);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const refreshUnread = useNotificationStore((state) => state.refreshUnread);
  const reset = useNotificationStore((state) => state.reset);

  useEffect(() => {
    if (!token) {
      reset();
      return;
    }
    void refreshUnread();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void refreshUnread();
      }
    });
    return () => subscription.remove();
  }, [token, refreshUnread, reset]);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: typography.small, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={typeof color === 'string' ? color : colors.muted} name="grid-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Aset',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={typeof color === 'string' ? color : colors.muted} name="cube-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={typeof color === 'string' ? color : colors.muted} name="sparkles-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifikasi',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={typeof color === 'string' ? color : colors.muted} name="notifications-outline" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={typeof color === 'string' ? color : colors.muted} name="person-outline" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
