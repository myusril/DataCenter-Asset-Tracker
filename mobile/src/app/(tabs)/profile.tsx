import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { ChartCard } from '../../components/ChartCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataList, DataRow } from '../../components/DataList';
import { GradientHeader } from '../../components/GradientHeader';
import { StatusPill } from '../../components/StatusPill';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { layout } from '../../theme/tokens';
import { text } from '../../theme/typography';
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
          <ChartCard title="Informasi akun">
            <DataList>
              <DataRow label="Email" value={user.email} />
              <DataRow label="Login terakhir" value={formatDateTime(user.lastLogin)} />
            </DataList>
          </ChartCard>

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
});
