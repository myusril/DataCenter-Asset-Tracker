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

import { extractErrorMessage } from '../../api/client';
import { registerRequest } from '../../api/auth';
import { Button } from '../../components/Button';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { elevation, gradients, motion } from '../../theme/tokens';
import { text } from '../../theme/typography';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    if (isSubmitting) return;

    // Validasi dasar
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Semua kolom bertanda wajib diisi.');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await registerRequest({
        fullName,
        username,
        email,
        password,
      });
      
      // Jika sukses, langsung arahkan ke halaman login
      router.replace('/(auth)/login');
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
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
              <Ionicons color={colors.primary} name="person-add" size={26} />
            </View>
            <Text style={styles.brand}>Daftar Akun Teknisi</Text>
            <Text style={styles.tagline}>
              Buat akun baru untuk mulai mengelola aset data center.
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
                Registrasi
              </Text>
              <Text style={styles.cardHint}>
                Lengkapi data di bawah ini untuk mendaftar.
              </Text>

              {/* Nama Lengkap */}
              <Text style={styles.label}>Nama Lengkap</Text>
              <View style={[styles.inputWrap, focused === 'fullName' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="card-outline" size={18} />
                <TextInput
                  autoCapitalize="words"
                  onBlur={() => setFocused(null)}
                  onChangeText={setFullName}
                  onFocus={() => setFocused('fullName')}
                  placeholder="Contoh: Budi Santoso"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  value={fullName}
                />
              </View>

              {/* Username */}
              <Text style={styles.label}>Username</Text>
              <View style={[styles.inputWrap, focused === 'username' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="person-outline" size={18} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={() => setFocused(null)}
                  onChangeText={setUsername}
                  onFocus={() => setFocused('username')}
                  placeholder="Pilih username unik"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  value={username}
                />
              </View>

              {/* Email */}
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrap, focused === 'email' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="mail-outline" size={18} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onBlur={() => setFocused(null)}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  placeholder="email@contoh.com"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  value={email}
                />
              </View>

              {/* Password */}
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, focused === 'password' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="lock-closed-outline" size={18} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={() => setFocused(null)}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('password')}
                  placeholder="Minimal 8 karakter"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  value={password}
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => setShowPassword((c) => !c)}
                  style={styles.eye}
                >
                  <Ionicons color={colors.muted} name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} />
                </Pressable>
              </View>

              {/* Konfirmasi Password */}
              <Text style={styles.label}>Konfirmasi Password</Text>
              <View style={[styles.inputWrap, focused === 'confirm' ? styles.inputFocused : null]}>
                <Ionicons color={colors.muted} name="lock-closed-outline" size={18} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={() => setFocused(null)}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocused('confirm')}
                  onSubmitEditing={handleSubmit}
                  placeholder="Ulangi password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  style={styles.input}
                  value={confirmPassword}
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => setShowConfirmPassword((c) => !c)}
                  style={styles.eye}
                >
                  <Ionicons color={colors.muted} name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} />
                </Pressable>
              </View>

              {error ? (
                <View accessibilityLiveRegion="polite" style={styles.errorBox}>
                  <Ionicons color={colors.dangerInk} name="alert-circle" size={18} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button
                label={isSubmitting ? 'Memproses...' : 'Daftar Sekarang'}
                loading={isSubmitting}
                onPress={handleSubmit}
                style={styles.submit}
              />
            </View>

            {/* Tombol Kembali ke Login */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Sudah punya akun? </Text>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <Text style={styles.linkText}>Masuk di sini</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  statusScrim: { backgroundColor: gradients.heroDeep[0], left: 0, position: 'absolute', right: 0, top: 0, zIndex: 5 },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
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
  cardTitle: { ...text.title },
  cardHint: { ...text.caption, color: colors.muted, marginTop: spacing.xs },
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
  eye: { alignItems: 'center', height: 44, justifyContent: 'center', width: 32 },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  errorText: { ...text.caption, color: colors.dangerInk, flex: 1 },
  submit: { marginTop: spacing.xl },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  footerText: { ...text.body, color: colors.muted },
  linkText: { ...text.body, color: colors.primary, fontWeight: 'bold' },
});