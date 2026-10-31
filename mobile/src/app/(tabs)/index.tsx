import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../components/Card';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { spacing, typography } from '../../theme/spacing';
import { greeting } from '../../utils/format';

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {greeting()}, {user?.fullName.split(' ')[0] ?? 'Pengguna'}
          </Text>
          <Text style={styles.subtitle}>Ringkasan aset data center hari ini.</Text>
        </View>

        <Card title="Ringkasan">
          <Text style={styles.emptyText}>
            Statistik aset dan risiko akan tampil di sini.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  greeting: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
});
