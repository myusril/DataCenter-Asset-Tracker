import axios from 'axios';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractErrorMessage, type ApiErrorBody } from '../../api/client';
import { updateProfile, type UpdateProfileInput } from '../../api/users';
import { Button } from '../../components/Button';
import { ChartCard } from '../../components/ChartCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataList, DataRow } from '../../components/DataList';
import { FormField } from '../../components/FormField';
import { GradientHeader } from '../../components/GradientHeader';
import { Sheet } from '../../components/Sheet';
import { StatusPill } from '../../components/StatusPill';
import { Toast, type ToastTone } from '../../components/Toast';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { layout } from '../../theme/tokens';
import { text } from '../../theme/typography';
import { formatDateTime, initialsOf, ROLE_LABELS } from '../../utils/format';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Re-authenticating after a password change proves the new credential works
// and clears the old one from a possibly shared device.
const PASSWORD_LOGOUT_DELAY_MS = 1400;

interface ToastState {
  message: string;
  tone: ToastTone;
}

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [signOutAfterSave, setSignOutAfterSave] = useState(false);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!signOutAfterSave) {
      return;
    }
    const timer = setTimeout(() => logout(), PASSWORD_LOGOUT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [logout, signOutAfterSave]);

  if (!user) {
    return null;
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const openEditor = () => {
    setFullName(user.fullName);
    setEmail(user.email);
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setFieldErrors({});
    setFormError(null);
    setEditing(true);
  };

  function closeEditor() {
    if (saving) {
      return;
    }
    setEditing(false);
    setFormError(null);
    setFieldErrors({});
  }

  async function handleSave() {
    if (!user || saving) {
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const changingPassword =
      newPassword.length > 0 || confirmPassword.length > 0 || currentPassword.length > 0;

    const nextErrors: Record<string, string> = {};
    if (!trimmedName) {
      nextErrors.fullName = 'Nama lengkap wajib diisi.';
    } else if (trimmedName.length > 100) {
      nextErrors.fullName = 'Nama lengkap maksimal 100 karakter.';
    }
    if (!trimmedEmail) {
      nextErrors.email = 'Email wajib diisi.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Format email tidak valid.';
    } else if (trimmedEmail.length > 255) {
      nextErrors.email = 'Email maksimal 255 karakter.';
    }
    if (changingPassword) {
      if (newPassword.length < 8) {
        nextErrors.password = 'Password baru minimal 8 karakter.';
      } else if (newPassword.length > 72) {
        nextErrors.password = 'Password baru maksimal 72 karakter.';
      }
      if (confirmPassword !== newPassword) {
        nextErrors.passwordConfirm = 'Konfirmasi password tidak cocok.';
      }
      if (!currentPassword) {
        nextErrors.currentPassword = 'Masukkan password saat ini.';
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: UpdateProfileInput = {};
    if (trimmedName !== user.fullName) {
      payload.fullName = trimmedName;
    }
    if (trimmedEmail !== user.email) {
      payload.email = trimmedEmail;
    }
    if (changingPassword) {
      payload.password = newPassword;
      payload.currentPassword = currentPassword;
    }
    if (Object.keys(payload).length === 0) {
      setFormError('Tidak ada perubahan untuk disimpan.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateProfile(payload);
      updateUser(updated);
      setEditing(false);
      setToast({
        message: changingPassword
          ? 'Password diperbarui. Silakan masuk kembali.'
          : 'Profil berhasil diperbarui.',
        tone: 'success',
      });
      if (changingPassword) {
        setSignOutAfterSave(true);
      }
    } catch (caught) {
      if (axios.isAxiosError(caught)) {
        const body = caught.response?.data as ApiErrorBody | undefined;
        const field = body?.errors?.[0]?.field;
        if (caught.response?.status === 409) {
          setFieldErrors({ email: 'Email sudah dipakai akun lain.' });
          return;
        }
        if (caught.response?.status === 400 && field === 'currentPassword') {
          setFieldErrors({ currentPassword: 'Password saat ini salah.' });
          return;
        }
      }
      setFormError(extractErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GradientHeader
          eyebrow="Akun"
          right={
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{initialsOf(user.fullName)}</Text>
            </View>
          }
          subtitle={`@${user.username}`}
          title={user.fullName}
        >
          <View style={styles.roleRow}>
            <StatusPill
              label={ROLE_LABELS[user.role]}
              tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}
            />
          </View>
        </GradientHeader>

        <View style={styles.body}>
          <Toast message={toast?.message ?? null} tone={toast?.tone} />

          <ChartCard title="Informasi akun">
            <DataList>
              <DataRow label="Email" value={user.email} />
              <DataRow label="Login terakhir" value={formatDateTime(user.lastLogin)} />
            </DataList>
          </ChartCard>

          <Button
            icon="create-outline"
            label="Edit profil"
            onPress={openEditor}
            variant="secondary"
          />

          <ChartCard title="Tentang aplikasi">
            <DataList>
              <DataRow label="Versi aplikasi" value={version} />
              <DataRow label="Model risiko" value="Heuristik v1.0" />
            </DataList>
          </ChartCard>

          <Button
            icon="log-out-outline"
            label="Keluar"
            onPress={() => setConfirming(true)}
            variant="danger"
          />
        </View>
      </ScrollView>

      <Sheet
        onClose={closeEditor}
        subtitle="Ubah nama dan email, atau ganti password akun Anda."
        title="Edit profil"
        visible={editing}
      >
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <FormField
          autoCapitalize="words"
          error={fieldErrors.fullName}
          label="Nama lengkap"
          maxLength={100}
          onChangeText={setFullName}
          placeholder="Nama yang tampil di aplikasi"
          value={fullName}
        />
        <FormField
          autoCapitalize="none"
          error={fieldErrors.email}
          keyboardType="email-address"
          label="Email"
          maxLength={255}
          onChangeText={setEmail}
          placeholder="nama@perusahaan.com"
          value={email}
        />

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ganti password</Text>
          <Text style={styles.sectionHint}>
            Biarkan kosong bila tidak ingin mengganti. Password baru minimal 8 karakter.
          </Text>
        </View>

        <FormField
          autoCapitalize="none"
          error={fieldErrors.password}
          label="Password baru"
          maxLength={72}
          onChangeText={setNewPassword}
          placeholder="Minimal 8 karakter"
          secureTextEntry
          value={newPassword}
        />
        <FormField
          autoCapitalize="none"
          error={fieldErrors.passwordConfirm}
          label="Konfirmasi password baru"
          maxLength={72}
          onChangeText={setConfirmPassword}
          placeholder="Ulangi password baru"
          secureTextEntry
          value={confirmPassword}
        />
        <FormField
          autoCapitalize="none"
          error={fieldErrors.currentPassword}
          hint="Wajib diisi saat mengganti password."
          label="Password saat ini"
          maxLength={72}
          onChangeText={setCurrentPassword}
          placeholder="Password yang dipakai sekarang"
          secureTextEntry
          value={currentPassword}
        />

        <View style={styles.sheetActions}>
          <Button
            label="Batal"
            onPress={closeEditor}
            style={styles.sheetButton}
            variant="secondary"
          />
          <Button
            label="Simpan"
            loading={saving}
            onPress={() => void handleSave()}
            style={styles.sheetButton}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        confirmLabel="Keluar"
        message="Sesi Anda akan dihapus dari perangkat ini. Anda perlu masuk kembali untuk membuka aplikasi."
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          logout();
        }}
        title="Keluar dari akun?"
        visible={confirming}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: layout.tabBarClearance,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarLabel: {
    ...text.title,
    color: colors.onPrimary,
  },
  roleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  body: {
    gap: layout.sectionGap,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
  },
  formError: {
    ...text.small,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    color: colors.dangerInk,
    padding: spacing.md,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    ...text.captionStrong,
    color: colors.textSecondary,
  },
  sectionHint: {
    ...text.small,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetButton: {
    flex: 1,
  },
});
