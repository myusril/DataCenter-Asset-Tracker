import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
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
import { GradientHeader } from '../../components/GradientHeader';
import { IconButton } from '../../components/IconButton';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { elevation, layout } from '../../theme/tokens';
import { text } from '../../theme/typography';
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
      <SafeAreaView edges={[]} style={styles.safe}>
        <StatusBar style="light" />
        <GradientHeader
          eyebrow="Riwayat perawatan"
          left={
            <IconButton
              accessibilityLabel="Kembali"
              icon="arrow-back"
              onPress={() => router.back()}
              tone="glass"
            />
          }
          subtitle="Formulir ini hanya untuk administrator."
          title="Catat Maintenance"
          variant="compact"
        />
        <AccessDenied />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar style="light" />
      <GradientHeader
        eyebrow="Riwayat perawatan"
        left={
          <IconButton
            accessibilityLabel="Kembali"
            icon="arrow-back"
            onPress={() => router.back()}
            tone="glass"
          />
        }
        subtitle="Lengkapi pekerjaan, biaya, dan hasil perawatan."
        title="Catat Maintenance"
        variant="compact"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {submitError ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Ionicons color={colors.dangerInk} name="alert-circle" size={18} />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}

          <FormSection title="Aset">
            <View style={styles.field}>
              <Text style={styles.label}>Aset yang dirawat *</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerVisible(true)}
                style={({ pressed }) => [
                  styles.picker,
                  errors.asset ? styles.pickerError : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                {asset ? (
                  <View style={styles.pickerContent}>
                    <View style={styles.pickerIcon}>
                      <Ionicons color={colors.primary} name="cube-outline" size={16} />
                    </View>
                    <View style={styles.pickerText}>
                      <Text numberOfLines={1} style={styles.pickerName}>
                        {asset.assetName}
                      </Text>
                      <Text style={styles.pickerCode}>{asset.assetCode}</Text>
                    </View>
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
            </View>
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

          <View style={styles.ruleNote}>
            <Ionicons color={colors.primary} name="information-circle-outline" size={18} />
            <Text style={styles.ruleNoteText}>
              Jenis Perbaikan, Upgrade, atau Penggantian membuat status aset menjadi Maintenance.
              Hasil yang diawali &quot;Resolved&quot; mengembalikan status menjadi Aktif.
            </Text>
          </View>

          <Button
            icon="save-outline"
            label="Simpan catatan"
            loading={submitting}
            onPress={handleSubmit}
          />
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
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalTitle}>Pilih aset</Text>
              <Text style={styles.modalSubtitle}>Cari berdasarkan kode atau nama aset.</Text>
            </View>
            <IconButton
              accessibilityLabel="Tutup"
              icon="close"
              onPress={onClose}
              size="sm"
              tone="soft"
            />
          </View>

          <View style={styles.searchBox}>
            <Ionicons color={colors.muted} name="search-outline" size={18} />
            <TextInput
              accessibilityLabel="Cari aset"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearch}
              placeholder="Cari kode atau nama aset"
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              value={search}
            />
          </View>

          {error ? <Text style={styles.fieldError}>{error}</Text> : null}

          <FlatList
            contentContainerStyle={styles.pickerList}
            data={items}
            ItemSeparatorComponent={() => <View style={styles.separatorLine} />}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              loading ? (
                <View style={styles.pickerLoading}>
                  <Skeleton height={56} radius={radius.sm} />
                  <Skeleton height={56} radius={radius.sm} />
                  <Skeleton height={56} radius={radius.sm} />
                </View>
              ) : (
                <Text style={styles.hint}>Tidak ada aset yang cocok.</Text>
              )
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onSelect({ id: item.id, assetCode: item.assetCode, assetName: item.assetName })
                }
                style={({ pressed }) => [styles.pickerRow, pressed ? styles.pressed : null]}
              >
                <View style={styles.pickerRowIcon}>
                  <Ionicons color={colors.textSecondary} name="cube-outline" size={16} />
                </View>
                <View style={styles.pickerText}>
                  <Text numberOfLines={1} style={styles.pickerName}>
                    {item.assetName}
                  </Text>
                  <Text numberOfLines={1} style={styles.pickerCode}>
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
    gap: spacing.lg,
    padding: layout.screenPadding,
    paddingBottom: spacing.huge,
  },
  field: {
    gap: 4,
  },
  label: {
    ...text.captionStrong,
    color: colors.textSecondary,
  },
  picker: {
    ...elevation.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerError: {
    borderColor: colors.danger,
  },
  pickerContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  pickerText: {
    flex: 1,
  },
  pickerName: {
    ...text.bodyStrong,
  },
  pickerCode: {
    ...text.small,
    marginTop: 1,
  },
  pickerPlaceholder: {
    ...text.body,
    color: colors.placeholder,
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  hint: {
    ...text.small,
  },
  fieldError: {
    ...text.small,
    color: colors.dangerInk,
  },
  errorBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    ...text.caption,
    color: colors.dangerInk,
    flex: 1,
  },
  ruleNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  ruleNoteText: {
    ...text.small,
    color: colors.primary,
    flex: 1,
  },
  overlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '86%',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 5,
    marginBottom: spacing.md,
    width: 44,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitleBlock: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    ...text.heading,
  },
  modalSubtitle: {
    ...text.caption,
    color: colors.muted,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...text.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.md,
  },
  pickerList: {
    paddingTop: spacing.sm,
  },
  pickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  pickerRowIcon: {
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  separatorLine: {
    backgroundColor: colors.border,
    height: 1,
  },
  pickerLoading: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});
