import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { ChartCard } from '../../../components/ChartCard';
import { EmptyState } from '../../../components/EmptyState';
import { GradientHeader } from '../../../components/GradientHeader';
import { IconButton } from '../../../components/IconButton';
import { FormSkeleton } from '../../../components/Skeleton';
import { useIsAdmin } from '../../../hooks/useIsAdmin';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { layout } from '../../../theme/tokens';
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
          title="Ubah Aset"
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
        subtitle="Perbarui identitas, lokasi, atau data jaringan aset."
        title="Ubah Aset"
        variant="compact"
      />

      {loading ? (
        <View style={styles.skeletonWrap}>
          <FormSkeleton />
        </View>
      ) : null}

      {!loading && !asset ? (
        <View style={styles.stateWrap}>
          <ChartCard>
            <EmptyState
              action={{ label: 'Coba lagi', onPress: () => void load() }}
              illustration="error"
              message={loadError ?? 'Aset tidak ditemukan.'}
              title="Gagal memuat aset"
            />
          </ChartCard>
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
  skeletonWrap: {
    paddingTop: spacing.lg,
  },
  stateWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
  },
});
