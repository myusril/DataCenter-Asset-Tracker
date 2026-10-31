import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing, typography } from '../theme/spacing';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

/** Shown when a technician reaches an admin-only route. */
export function AccessDenied() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <EmptyState
        icon="lock-closed-outline"
        message="Halaman ini hanya untuk administrator. Hubungi administrator bila Anda perlu mengubah data."
        title="Akses ditolak"
      />
      <Button
        label="Kembali"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace('/(tabs)');
        }}
        style={styles.button}
        variant="secondary"
      />
      <Text style={styles.caption}>Akun teknisi hanya dapat melihat data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  button: {
    alignSelf: 'stretch',
  },
  caption: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
