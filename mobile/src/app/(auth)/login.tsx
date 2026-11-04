import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL, extractErrorMessage } from '../../api/client';
import { Button } from '../../components/Button';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { elevation, gradients, motion } from '../../theme/tokens';
import { text } from '../../theme/typography';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const login = useAuthStore((state) => state.login);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, {
      duration: motion.slow,
      easing: motion.easing,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [enter, reduced]);

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
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={gradients.heroDeep}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}
          >
            <View style={styles.logo}>
              <Ionicons color={colors.primary} name="server" size={26} />
            </View>
            <Text style={styles.brand}>DataCenter Tracker</Text>
            <Text style={styles.tagline}>
              Kelola inventaris, jaringan, dan risiko aset data center dari satu tempat.
            </Text>
          </LinearGradient>

          <Animated.View
            style={[
              styles.cardWrap,
              {
                opacity: enter,
                transform: [
                  { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Masuk
              </Text>
              <Text style={styles.cardHint}>
                Gunakan akun yang sudah terdaftar untuk melanjutkan.
              </Text>

              <Text style={styles.label}>Username</Text>
              <View style={[styles.inputWrap, focused === 'username' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="person-outline" size={18} />
                <TextInput
                  accessibilityLabel="Username"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  onBlur={() => setFocused(null)}
                  onChangeText={setUsername}
                  onFocus={() => setFocused('username')}
                  placeholder="contoh: admin"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  textContentType="username"
                  value={username}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, focused === 'password' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="lock-closed-outline" size={18} />
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="password"
                  autoCorrect={false}
                  onBlur={() => setFocused(null)}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('password')}
                  onSubmitEditing={handleSubmit}
                  placeholder="Masukkan password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  textContentType="password"
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.eye}
                >
                  <Ionicons
                    color={colors.muted}
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                  />
                </Pressable>
              </View>

              {error ? (
                <View accessibilityLiveRegion="polite" style={styles.errorBox}>
                  <Ionicons color={colors.dangerInk} name="alert-circle" size={18} />
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

            <View style={styles.serverRow}>
              <Ionicons color={colors.muted} name="server-outline" size={12} />
              <Text numberOfLines={1} style={styles.serverNote}>
                {API_URL}
              </Text>
            </View>
          </Animated.View>
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
  statusScrim: {
    backgroundColor: gradients.heroDeep[0],
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingBottom: 72,
    paddingHorizontal: spacing.xxl,
  },
  logo: {
    ...elevation.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  brand: {
    ...text.title,
    color: colors.onPrimary,
    fontSize: 22,
    lineHeight: 28,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  tagline: {
    ...text.caption,
    color: colors.onPrimaryMuted,
    marginTop: spacing.sm,
    maxWidth: 290,
    textAlign: 'center',
  },
  cardWrap: {
    marginTop: -48,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  card: {
    ...elevation.floating,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  cardTitle: {
    ...text.title,
  },
  cardHint: {
    ...text.caption,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  label: {
    ...text.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.lg,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderColor: 'transparent',
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  input: {
    ...text.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.md,
  },
  eye: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 32,
  },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  errorText: {
    ...text.caption,
    color: colors.dangerInk,
    flex: 1,
  },
  submit: {
    marginTop: spacing.xl,
  },
  serverRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  serverNote: {
    ...text.small,
    color: colors.muted,
    flexShrink: 1,
  },
});
