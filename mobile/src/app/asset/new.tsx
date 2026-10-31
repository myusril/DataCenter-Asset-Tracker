import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAsset, describeAssetError, type AssetWritePayload } from '../../api/assets';
import { AccessDenied } from '../../components/AccessDenied';
import { AssetForm } from '../../components/AssetForm';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { colors } from '../../theme/colors';

export default function NewAssetScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={() => router.back()} title="Tambah Aset" />
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
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} title="Tambah Aset" />
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
