import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, extractErrorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setError(null);
    try {
      await login(username, password);
      router.replace('/(tabs)');
    } catch (caught) {
      setError(extractErrorMessage(caught));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>DC</Text>
            </View>
            <Text style={styles.title}>DataCenter Tracker</Text>
            <Text style={styles.subtitle}>
              Kelola inventaris, jaringan, dan risiko aset data center dari satu tempat.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masuk</Text>
            <Text style={styles.cardHint}>
              Gunakan akun yang sudah terdaftar untuk melanjutkan.
            </Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setUsername}
              placeholder="contoh: admin"
              placeholderTextColor={colors.muted}
              style={styles.input}
              textContentType="username"
              value={username}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              placeholder="Masukkan password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label="Masuk"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={styles.submit}
            />
          </View>

          <Text style={styles.serverNote}>Server: {API_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  logoText: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '600',
  },
  cardHint: {
    color: colors.muted,
    fontSize: typography.caption,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    height: 46,
    paddingHorizontal: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 19,
  },
  submit: {
    marginTop: spacing.xl,
  },
  serverNote: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
