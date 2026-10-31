import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  describeAssetError,
  fetchAssetDetail,
  updateAsset,
  type AssetWritePayload,
} from '../../../api/assets';
import { extractErrorMessage } from '../../../api/client';
import { AccessDenied } from '../../../components/AccessDenied';
import { AssetForm, assetToFormInitial } from '../../../components/AssetForm';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Loading } from '../../../components/Loading';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useIsAdmin } from '../../../hooks/useIsAdmin';
import { colors } from '../../../theme/colors';
import { spacing, typography } from '../../../theme/spacing';
import type { AssetDetail } from '../../../types/api';

export default function EditAssetScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { id } = useLocalSearchParams<{ id: string }>();
  const assetId = Number(id);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(assetId) || assetId <= 0) {
      setLoadError('Aset tidak ditemukan.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setAsset(await fetchAssetDetail(assetId));
    } catch (caught) {
      setLoadError(extractErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    if (isAdmin) {
      void load();
    }
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={() => router.back()} title="Ubah Aset" />
        <AccessDenied />
      </SafeAreaView>
    );
  }

  async function handleSubmit(payload: AssetWritePayload) {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateAsset(assetId, payload);
      router.back();
    } catch (caught) {
      setSubmitError(describeAssetError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} title="Ubah Aset" />

      {loading ? <Loading message="Memuat data aset..." /> : null}

      {!loading && !asset ? (
        <View style={styles.stateBox}>
          <Card title="Gagal memuat aset">
            <Text style={styles.bodyText}>{loadError ?? 'Aset tidak ditemukan.'}</Text>
            <Button label="Coba lagi" onPress={() => void load()} style={styles.retry} />
          </Card>
        </View>
      ) : null}

      {asset ? (
        <AssetForm
          error={submitError}
          initial={assetToFormInitial(asset)}
          isEdit
          key={asset.id}
          onSubmit={(payload) => void handleSubmit(payload)}
          submitLabel="Simpan perubahan"
          submitting={submitting}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  stateBox: {
    padding: spacing.lg,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  retry: {
    marginTop: spacing.lg,
  },
});
