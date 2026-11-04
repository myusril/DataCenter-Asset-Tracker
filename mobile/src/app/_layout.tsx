import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setUnauthorizedHandler } from '../api/session';
import {
  configurePushNotifications,
  registerPushToken,
  subscribeToPushTokenRefresh,
} from '../notifications/push';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { gradients } from '../theme/tokens';
import { text } from '../theme/typography';

// Foreground presentation and the Android channel must exist before any
// notification arrives, so both are configured at module scope.
configurePushNotifications();

// Registered at module scope so a 401 from a screen's first fetch is handled
// even before any effect has run. `client.ts` only calls this seam.
setUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
  router.replace('/(auth)/login');
});

// The badge store is a module singleton, so clear it whenever the session
// changes (logout or a different account) instead of relying on unmount order.
useAuthStore.subscribe((state, previous) => {
  if (state.token !== previous.token) {
    useNotificationStore.getState().reset();
  }
});

let coldStartResponseHandled = false;

/**
 * Push taps carry `{ type, assetId?, maintenanceId? }` as FCM data strings.
 * Reminders open the maintenance detail; AI alerts and any fallback open the
 * asset detail. Anonymous taps are ignored.
 */
function openNotificationTarget(data: Record<string, unknown> | undefined): void {
  if (!data || !useAuthStore.getState().token) {
    return;
  }

  const type = typeof data.type === 'string' ? data.type : '';
  const maintenanceId = Number(data.maintenanceId);
  const assetId = Number(data.assetId);

  if (
    type === 'MAINTENANCE_REMINDER' &&
    Number.isInteger(maintenanceId) &&
    maintenanceId > 0
  ) {
    router.push(`/maintenance/${maintenanceId}` as Href);
    return;
  }

  if (Number.isInteger(assetId) && assetId > 0) {
    router.push(`/asset/${assetId}` as Href);
  }
}

export default function RootLayout() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const token = useAuthStore((state) => state.token);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (!useAuthStore.persist.hasHydrated()) {
      void useAuthStore.getState().loadFromStorage();
    }
  }, []);

  // Register after login and after auto-login; the backend upserts by token, so
  // repeated launches are idempotent.
  useEffect(() => {
    if (!token) {
      return;
    }
    void registerPushToken();
  }, [token]);

  useEffect(() => subscribeToPushTokenRefresh(), []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationTarget(response.notification.request.content.data);
    });
    return () => subscription.remove();
  }, []);

  // The splash is gated on both the font assets and the persisted session, so
  // the first painted screen already has the real typeface and the right route.
  const ready = (fontsLoaded || fontError !== null) && isHydrated;

  // A tap that launched the app is delivered once; handle it after the router
  // and the persisted session are ready.
  useEffect(() => {
    if (!ready || coldStartResponseHandled) {
      return;
    }
    coldStartResponseHandled = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        openNotificationTarget(response.notification.request.content.data);
      }
    });
  }, [ready]);

  if (!ready) {
    return <Splash />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

function Splash() {
  return (
    <LinearGradient
      colors={gradients.heroDeep}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.splash}
    >
      <View pointerEvents="none" style={styles.blob} />
      <View style={styles.logo}>
        <Ionicons color={colors.primary} name="server" size={28} />
      </View>
      <Text style={styles.title}>DataCenter Tracker</Text>
      <Text style={styles.caption}>Inventaris, jaringan, dan risiko aset dalam satu tempat.</Text>
      <ActivityIndicator color={colors.onPrimary} style={styles.spinner} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.xxl,
  },
  blob: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 320,
    position: 'absolute',
    right: -120,
    top: -80,
    width: 320,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    elevation: 6,
    height: 64,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    width: 64,
  },
  title: {
    ...text.title,
    color: colors.onPrimary,
    marginTop: spacing.lg,
  },
  caption: {
    ...text.caption,
    color: colors.onPrimaryMuted,
    marginTop: spacing.sm,
    maxWidth: 280,
    textAlign: 'center',
  },
  spinner: {
    marginTop: spacing.xxl,
  },
});
