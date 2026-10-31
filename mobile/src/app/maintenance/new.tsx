import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchAssetDetail, fetchAssets } from '../../api/assets';
import { extractErrorMessage } from '../../api/client';
import { createMaintenanceRecord } from '../../api/maintenance';
import { AccessDenied } from '../../components/AccessDenied';
import { Button } from '../../components/Button';
import { FormField, FormSection, SelectField } from '../../components/FormField';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusPill } from '../../components/StatusPill';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing, typography } from '../../theme/spacing';
import type { Asset, MaintenanceType } from '../../types/api';
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS, MAINTENANCE_TYPE_LABELS } from '../../utils/format';
import { ASSET_STATUS_TONES } from '../../utils/pills';

const TYPE_OPTIONS = (Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map(
  (value) => ({ value, label: MAINTENANCE_TYPE_LABELS[value] }),
);

interface SelectedAsset {
  id: number;
  assetCode: string;
  assetName: string;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export default function NewMaintenanceScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const user = useAuthStore((state) => state.user);
  const { assetId } = useLocalSearchParams<{ assetId?: string }>();

  const [asset, setAsset] = useState<SelectedAsset | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('ROUTINE');
  const [maintenanceDate, setMaintenanceDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [result, setResult] = useState('');
  const [cost, setCost] = useState('');
  const [nextSchedule, setNextSchedule] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const preselected = Number(assetId);
    if (!Number.isFinite(preselected) || preselected <= 0) {
      return;
    }
    let active = true;
    fetchAssetDetail(preselected)
      .then((detail) => {
        if (active) {
          setAsset({ id: detail.id, assetCode: detail.assetCode, assetName: detail.assetName });
        }
      })
      .catch(() => {
        // A missing preselection just leaves the picker available.
      });
    return () => {
      active = false;
    };
  }, [assetId]);

  async function handleSubmit() {
    if (submitting) {
      return;
    }
    const nextErrors: Record<string, string> = {};
    if (!asset) {
      nextErrors.asset = 'Pilih aset yang dirawat.';
    }
    if (!isIsoDate(maintenanceDate.trim())) {
      nextErrors.maintenanceDate = 'Gunakan format YYYY-MM-DD.';
    }
    if (nextSchedule.trim() && !isIsoDate(nextSchedule.trim())) {
      nextErrors.nextSchedule = 'Gunakan format YYYY-MM-DD.';
    }
    const parsedCost = cost.trim() ? Number(cost.trim()) : undefined;
    if (parsedCost !== undefined && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      nextErrors.cost = 'Biaya harus berupa angka 0 atau lebih.';
    }
    if (description.trim().length > 1000) {
      nextErrors.description = 'Uraian maksimal 1000 karakter.';
    }
    if (result.trim().length > 1000) {
      nextErrors.result = 'Hasil maksimal 1000 karakter.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !asset) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createMaintenanceRecord({
        assetId: asset.id,
        maintenanceType,
        maintenanceDate: maintenanceDate.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(result.trim() ? { result: result.trim() } : {}),
        ...(parsedCost === undefined ? {} : { cost: parsedCost }),
        ...(nextSchedule.trim() ? { nextSchedule: nextSchedule.trim() } : {}),
      });
      router.back();
    } catch (caught) {
      setSubmitError(extractErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={() => router.back()} title="Catat Maintenance" />
        <AccessDenied />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenHeader onBack={() => router.back()} title="Catat Maintenance" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {submitError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}

          <FormSection title="Aset">
            <Text style={styles.label}>Aset yang dirawat *</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerVisible(true)}
              style={({ pressed }) => [styles.picker, pressed ? styles.pressed : null]}
            >
              {asset ? (
                <View style={styles.pickerBody}>
                  <Text style={styles.pickerName}>{asset.assetName}</Text>
                  <Text style={styles.pickerCode}>{asset.assetCode}</Text>
                </View>
              ) : (
                <Text style={styles.pickerPlaceholder}>Pilih aset...</Text>
              )}
              <Ionicons color={colors.muted} name="chevron-down" size={18} />
            </Pressable>
            {errors.asset ? <Text style={styles.fieldError}>{errors.asset}</Text> : null}
            <Text style={styles.hint}>
              Teknisi tercatat otomatis: {user?.fullName ?? 'pengguna yang login'}. Dokumen sumber
              tidak menyediakan endpoint daftar user, jadi nama teknisi tidak dapat dipilih.
            </Text>
          </FormSection>

          <FormSection title="Pekerjaan">
            <SelectField
              label="Jenis perawatan *"
              onChange={setMaintenanceType}
              options={TYPE_OPTIONS}
              value={maintenanceType}
            />
            <FormField
              autoCapitalize="none"
              error={errors.maintenanceDate}
              hint="Format YYYY-MM-DD."
              label="Tanggal perawatan *"
              maxLength={10}
              onChangeText={setMaintenanceDate}
              placeholder="2026-10-31"
              value={maintenanceDate}
            />
            <FormField
              error={errors.description}
              label="Uraian pekerjaan"
              maxLength={1000}
              multiline
              onChangeText={setDescription}
              placeholder="Contoh: ganti modul RAM slot 2"
              value={description}
            />
            <FormField
              error={errors.result}
              hint="Awali dengan 'Resolved' agar status aset kembali menjadi Aktif."
              label="Hasil"
              maxLength={1000}
              multiline
              onChangeText={setResult}
              placeholder="Contoh: Resolved - RAM diganti"
              value={result}
            />
            <FormField
              error={errors.cost}
              keyboardType="number-pad"
              label="Biaya (Rp)"
              onChangeText={setCost}
              placeholder="850000"
              value={cost}
            />
            <FormField
              autoCapitalize="none"
              error={errors.nextSchedule}
              hint="Opsional. Format YYYY-MM-DD."
              label="Jadwal berikutnya"
              maxLength={10}
              onChangeText={setNextSchedule}
              placeholder="2027-04-30"
              value={nextSchedule}
            />
          </FormSection>

          <Text style={styles.ruleNote}>
            Jenis Perbaikan, Upgrade, atau Penggantian membuat status aset menjadi Maintenance.
            Hasil yang diawali &quot;Resolved&quot; mengembalikan status menjadi Aktif.
          </Text>

          <Button label="Simpan catatan" loading={submitting} onPress={handleSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AssetPicker
        onClose={() => setPickerVisible(false)}
        onSelect={(picked) => {
          setAsset(picked);
          setErrors((previous) => ({ ...previous, asset: '' }));
          setPickerVisible(false);
        }}
        visible={pickerVisible}
      />
    </SafeAreaView>
  );
}

function AssetPicker({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (asset: SelectedAsset) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAssets({ search: debouncedSearch, page: 1, limit: 20 });
      setItems(result.items);
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    void load();
  }, [visible, load]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pilih aset</Text>
            <Pressable accessibilityLabel="Tutup" accessibilityRole="button" onPress={onClose}>
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons color={colors.muted} name="search-outline" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearch}
              placeholder="Cari kode atau nama aset"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              value={search}
            />
          </View>

          {error ? <Text style={styles.fieldError}>{error}</Text> : null}

          <FlatList
            data={items}
            ItemSeparatorComponent={() => <View style={styles.separatorLine} />}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={colors.accent} style={styles.loading} />
              ) : (
                <Text style={styles.hint}>Tidak ada aset yang cocok.</Text>
              )
            }
            style={styles.pickerList}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onSelect({ id: item.id, assetCode: item.assetCode, assetName: item.assetName })
                }
                style={({ pressed }) => [styles.pickerRow, pressed ? styles.pressed : null]}
              >
                <View style={styles.pickerBody}>
                  <Text style={styles.pickerName}>{item.assetName}</Text>
                  <Text style={styles.pickerCode}>
                    {item.assetCode} · {ASSET_TYPE_LABELS[item.assetType]}
                  </Text>
                </View>
                <StatusPill
                  label={ASSET_STATUS_LABELS[item.status]}
                  tone={ASSET_STATUS_TONES[item.status]}
                />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: '600',
  },
  picker: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerBody: {
    flex: 1,
  },
  pickerName: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  pickerCode: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 1,
  },
  pickerPlaceholder: {
    color: colors.muted,
    fontSize: typography.caption,
  },
  pressed: {
    opacity: 0.85,
  },
  hint: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
  },
  fieldError: {
    color: colors.danger,
    fontSize: typography.small,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
    lineHeight: 18,
  },
  ruleNote: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
  },
  overlay: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.caption,
    paddingVertical: 0,
  },
  pickerList: {
    marginTop: spacing.md,
  },
  pickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  separatorLine: {
    backgroundColor: colors.border,
    height: 1,
  },
  loading: {
    marginVertical: spacing.xl,
  },
});
