import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAsset, describeAssetError, type AssetWritePayload } from '../../api/assets';
import { AccessDenied } from '../../components/AccessDenied';
import { AssetForm } from '../../components/AssetForm';
import { GradientHeader } from '../../components/GradientHeader';
import { IconButton } from '../../components/IconButton';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { colors } from '../../theme/colors';

export default function NewAssetScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <SafeAreaView edges={[]} style={styles.safe}>
        <StatusBar style="light" />
        <GradientHeader
          eyebrow="Inventaris"
          left={
            <IconButton
              accessibilityLabel="Kembali"
              icon="arrow-back"
              onPress={() => router.back()}
              tone="glass"
            />
          }
          subtitle="Formulir ini hanya untuk administrator."
          title="Tambah Aset"
          variant="compact"
        />
        <AccessDenied />
      </SafeAreaView>
    );
  }

  async function handleSubmit(payload: AssetWritePayload) {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAsset(payload);
      router.replace(`/asset/${created.id}`);
    } catch (caught) {
      setError(describeAssetError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style="light" />
      <GradientHeader
        eyebrow="Inventaris"
        left={
          <IconButton
            accessibilityLabel="Kembali"
            icon="arrow-back"
            onPress={() => router.back()}
            tone="glass"
          />
        }
        subtitle="Lengkapi identitas, lokasi, dan data jaringan aset."
        title="Tambah Aset"
        variant="compact"
      />
      <AssetForm
        error={error}
        onSubmit={(payload) => void handleSubmit(payload)}
        submitLabel="Simpan aset"
        submitting={submitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
