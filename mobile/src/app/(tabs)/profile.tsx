import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusPill } from '../../components/StatusPill';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import { layout } from '../../theme/tokens';
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
            style={styles.rolePill}
            tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}
          />
        </View>

        <Card title="Informasi akun">
          <Row label="Email" value={user.email} />
          <Row label="Login terakhir" value={formatDateTime(user.lastLogin)} />
        </Card>

        <Card title="Tentang aplikasi">
          <Row label="Versi aplikasi" value={version} />
          <Row label="Model risiko" value="Heuristik v1.0" />
        </Card>

        <Button label="Keluar" onPress={() => setConfirming(true)} variant="danger" />
      </ScrollView>

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
    paddingBottom: layout.tabBarClearance,
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
  rolePill: {
    alignSelf: 'center',
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
});
