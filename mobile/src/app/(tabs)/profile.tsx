import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import { formatDateTime, initialsOf, ROLE_LABELS } from '../../utils/format';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [confirming, setConfirming] = useState(false);

  if (!user) {
    return null;
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profil</Text>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(user.fullName)}</Text>
          </View>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <StatusPill
            label={ROLE_LABELS[user.role]}
            tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}
          />
        </View>

        <Card title="Informasi akun">
          <Row label="Nama lengkap" value={user.fullName} />
          <Row label="Username" value={user.username} />
          <Row label="Email" value={user.email} />
          <Row label="Role" value={ROLE_LABELS[user.role]} />
          <Row label="Login terakhir" value={formatDateTime(user.lastLogin)} />
        </Card>

        <Card title="Tentang aplikasi">
          <Row label="Versi aplikasi" value={version} />
          <Row label="Model risiko" value="Heuristik v1.0" />
        </Card>

        {confirming ? (
          <Card title="Keluar dari akun?">
            <Text style={styles.confirmText}>
              Sesi Anda akan dihapus dari perangkat ini. Anda perlu masuk kembali untuk membuka
              aplikasi.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                label="Batal"
                onPress={() => setConfirming(false)}
                style={styles.confirmButton}
                variant="secondary"
              />
              <Button
                label="Keluar"
                onPress={logout}
                style={styles.confirmButton}
                variant="danger"
              />
            </View>
          </Card>
        ) : (
          <Button label="Keluar" onPress={() => setConfirming(true)} variant="danger" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 72,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '600',
  },
  username: {
    color: colors.muted,
    fontSize: typography.caption,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  rowValue: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '500',
    maxWidth: '65%',
    textAlign: 'right',
  },
  confirmText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  confirmButton: {
    flex: 1,
  },
});
