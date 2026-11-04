import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../store/auth';
import { useNotificationStore } from '../../store/notifications';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { elevation } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

const TABS = [
  { name: 'index', title: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { name: 'assets', title: 'Aset', icon: 'cube-outline', iconActive: 'cube' },
  { name: 'ai', title: 'Risiko', icon: 'shield-half-outline', iconActive: 'shield-half' },
  {
    name: 'notifications',
    title: 'Notifikasi',
    icon: 'notifications-outline',
    iconActive: 'notifications',
  },
  { name: 'profile', title: 'Profil', icon: 'person-outline', iconActive: 'person' },
] as const;

/** React Navigation passes ColorValue; Ionicons and Text want plain strings. */
function tint(color: unknown): string {
  return typeof color === 'string' ? color : colors.textSecondary;
}

function TabLabel({ color, label }: { color: string; label: string }) {
  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      numberOfLines={1}
      style={[styles.label, { color }]}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
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
    <>
      <StatusBar style={pathname === '/' || pathname === '/ai' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarHideOnKeyboard: true,
          tabBarIconStyle: styles.icon,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarItemStyle: styles.item,
          tabBarStyle: [
            styles.bar,
            {
              bottom: Math.max(insets.bottom, 12),
              height: Platform.OS === 'web' ? 68 : 64,
            },
          ],
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  color={tint(color)}
                  name={focused ? tab.iconActive : tab.icon}
                  size={21}
                />
              ),
              tabBarLabel: ({ color }) => <TabLabel color={tint(color)} label={tab.title} />,
              ...(tab.name === 'notifications'
                ? {
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                    tabBarBadgeStyle: styles.badge,
                  }
                : {}),
            }}
          />
        ))}
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...elevation.tabBar,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderTopWidth: 0,
    borderWidth: 1,
    left: 14,
    paddingBottom: 6,
    paddingHorizontal: 4,
    paddingTop: 6,
    position: 'absolute',
    right: 14,
  },
  item: {
    borderRadius: radius.lg,
  },
  icon: {
    marginBottom: -2,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: colors.danger,
    color: colors.onPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 10,
    minWidth: 17,
  },
});
