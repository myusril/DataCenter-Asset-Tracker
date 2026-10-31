import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/auth';
import { colors } from '../theme/colors';
import { spacing, typography } from '../theme/spacing';

export default function RootLayout() {
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (!useAuthStore.persist.hasHydrated()) {
      void useAuthStore.getState().loadFromStorage();
    }
  }, []);

  if (!isHydrated) {
    return (
      <View style={styles.splash}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>DC</Text>
        </View>
        <Text style={styles.title}>DataCenter Tracker</Text>
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
        <Text style={styles.caption}>Menyiapkan aplikasi...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  logoText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  caption: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: spacing.sm,
  },
});
