import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/spacing';

export default function TabsLayout() {
  const token = useAuthStore((state) => state.token);

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
