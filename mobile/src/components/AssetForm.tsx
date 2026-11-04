import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AssetWritePayload } from '../api/assets';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import type {
  AssetDetail,
  AssetStatus,
  AssetType,
  ConnectionStatus,
} from '../types/api';
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  CONNECTION_LABELS,
} from '../utils/format';
import { Button } from './Button';
import { FormField, FormSection, SelectField } from './FormField';

const ASSET_TYPE_OPTIONS = (Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((value) => ({
  value,
  label: ASSET_TYPE_LABELS[value],
}));

const ASSET_STATUS_OPTIONS = (Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map(
  (value) => ({ value, label: ASSET_STATUS_LABELS[value] }),
);

const CONNECTION_OPTIONS = (Object.keys(CONNECTION_LABELS) as ConnectionStatus[]).map(
  (value) => ({ value, label: CONNECTION_LABELS[value] }),
);

interface AssetFormValues {
  assetCode: string;
  assetName: string;
  assetType: AssetType;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyEnd: string;
  status: AssetStatus;
  description: string;
  dataCenter: string;
  rack: string;
  rackSlot: string;
  floor: string;
  room: string;
  hostname: string;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  macAddress: string;
  connectionStatus: ConnectionStatus;
  notes: string;
}

const EMPTY_VALUES: AssetFormValues = {
  assetCode: '',
  assetName: '',
  assetType: 'SERVER',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  warrantyEnd: '',
  status: 'ACTIVE',
  description: '',
  dataCenter: '',
  rack: '',
  rackSlot: '',
  floor: '',
  room: '',
  hostname: '',
  ipAddress: '',
  subnetMask: '',
  gateway: '',
  macAddress: '',
  connectionStatus: 'UNKNOWN',
  notes: '',
};

type FieldErrors = Partial<Record<keyof AssetFormValues, string>>;

/** Maps an asset detail into field values for the edit form. */
export function assetToFormInitial(asset: AssetDetail): AssetWritePayload {
  return {
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    assetType: asset.assetType,
    brand: asset.brand ?? '',
    model: asset.model ?? '',
    serialNumber: asset.serialNumber ?? '',
    purchaseDate: asset.purchaseDate ?? '',
    warrantyEnd: asset.warrantyEnd ?? '',
    status: asset.status,
    description: asset.description ?? '',
    location: asset.location
      ? {
          dataCenter: asset.location.dataCenter,
          rack: asset.location.rack ?? '',
          rackSlot: asset.location.rackSlot ?? '',
          floor: asset.location.floor ?? '',
          room: asset.location.room ?? '',
        }
      : undefined,
    network: asset.network
      ? {
          hostname: asset.network.hostname ?? '',
          ipAddress: asset.network.ipAddress ?? '',
          subnetMask: asset.network.subnetMask ?? '',
          gateway: asset.network.gateway ?? '',
          macAddress: asset.network.macAddress ?? '',
          connectionStatus: asset.network.connectionStatus,
          notes: asset.network.notes ?? '',
        }
      : undefined,
  };
}

function toFormValues(initial?: AssetWritePayload): AssetFormValues {
  if (!initial) {
    return EMPTY_VALUES;
  }
  return {
    ...EMPTY_VALUES,
    ...(initial.assetCode === undefined ? {} : { assetCode: initial.assetCode }),
    ...(initial.assetName === undefined ? {} : { assetName: initial.assetName }),
    ...(initial.assetType === undefined ? {} : { assetType: initial.assetType }),
    ...(initial.brand === undefined ? {} : { brand: initial.brand }),
    ...(initial.model === undefined ? {} : { model: initial.model }),
    ...(initial.serialNumber === undefined ? {} : { serialNumber: initial.serialNumber }),
    ...(initial.purchaseDate === undefined ? {} : { purchaseDate: initial.purchaseDate }),
    ...(initial.warrantyEnd === undefined ? {} : { warrantyEnd: initial.warrantyEnd }),
    ...(initial.status === undefined ? {} : { status: initial.status }),
    ...(initial.description === undefined ? {} : { description: initial.description }),
    ...(initial.location === undefined
      ? {}
      : {
          dataCenter: initial.location.dataCenter,
          rack: initial.location.rack ?? '',
          rackSlot: initial.location.rackSlot ?? '',
          floor: initial.location.floor ?? '',
          room: initial.location.room ?? '',
        }),
    ...(initial.network === undefined
      ? {}
      : {
          hostname: initial.network.hostname ?? '',
          ipAddress: initial.network.ipAddress ?? '',
          subnetMask: initial.network.subnetMask ?? '',
          gateway: initial.network.gateway ?? '',
          macAddress: initial.network.macAddress ?? '',
          connectionStatus: initial.network.connectionStatus ?? 'UNKNOWN',
          notes: initial.network.notes ?? '',
        }),
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}

function isMacAddress(value: string): boolean {
  return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(value);
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Client-side validation mirroring the API limits, without a schema library. */
function validate(values: AssetFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.assetCode.trim()) {
    errors.assetCode = 'Kode aset wajib diisi.';
  } else if (!/^[A-Za-z0-9._-]+$/.test(values.assetCode.trim())) {
    errors.assetCode = 'Kode hanya boleh huruf, angka, titik, garis bawah, atau strip.';
  } else if (values.assetCode.trim().length > 30) {
    errors.assetCode = 'Kode aset maksimal 30 karakter.';
  }

  if (!values.assetName.trim()) {
    errors.assetName = 'Nama aset wajib diisi.';
  } else if (values.assetName.trim().length > 100) {
    errors.assetName = 'Nama aset maksimal 100 karakter.';
  }

  if (values.brand.trim().length > 50) {
    errors.brand = 'Merek maksimal 50 karakter.';
  }
  if (values.model.trim().length > 50) {
    errors.model = 'Model maksimal 50 karakter.';
  }
  if (values.serialNumber.trim().length > 100) {
    errors.serialNumber = 'Serial number maksimal 100 karakter.';
  }
  if (values.description.trim().length > 1000) {
    errors.description = 'Deskripsi maksimal 1000 karakter.';
  }

  for (const key of ['purchaseDate', 'warrantyEnd'] as const) {
    const value = values[key].trim();
    if (value && !isIsoDate(value)) {
      errors[key] = 'Gunakan format YYYY-MM-DD, contoh 2026-10-31.';
    }
  }
  if (
    values.purchaseDate.trim() &&
    values.warrantyEnd.trim() &&
    isIsoDate(values.purchaseDate.trim()) &&
    isIsoDate(values.warrantyEnd.trim()) &&
    values.warrantyEnd.trim() < values.purchaseDate.trim()
  ) {
    errors.warrantyEnd = 'Garansi tidak boleh berakhir sebelum tanggal pembelian.';
  }

  const hasLocationDetail = [values.rack, values.rackSlot, values.floor, values.room].some(
    (value) => value.trim().length > 0,
  );
  if (!values.dataCenter.trim()) {
    if (hasLocationDetail) {
      errors.dataCenter = 'Data center wajib diisi bila rak atau lantai diisi.';
    }
  } else if (values.dataCenter.trim().length > 100) {
    errors.dataCenter = 'Data center maksimal 100 karakter.';
  }

  if (values.hostname.trim().length > 100) {
    errors.hostname = 'Hostname maksimal 100 karakter.';
  }
  if (values.ipAddress.trim() && !isIpv4(values.ipAddress.trim())) {
    errors.ipAddress = 'Alamat IP harus berbentuk IPv4, contoh 192.168.1.10.';
  }
  if (values.subnetMask.trim() && !isIpv4(values.subnetMask.trim())) {
    errors.subnetMask = 'Subnet mask harus berbentuk IPv4.';
  }
  if (values.gateway.trim() && !isIpv4(values.gateway.trim())) {
    errors.gateway = 'Gateway harus berbentuk IPv4.';
  }
  if (values.macAddress.trim() && !isMacAddress(values.macAddress.trim())) {
    errors.macAddress = 'MAC address harus berbentuk XX:XX:XX:XX:XX:XX.';
  }
  if (values.notes.trim().length > 500) {
    errors.notes = 'Catatan jaringan maksimal 500 karakter.';
  }

  return errors;
}

const LOCATION_KEYS = ['dataCenter', 'rack', 'rackSlot', 'floor', 'room'] as const;
const NETWORK_TEXT_KEYS = [
  'hostname',
  'ipAddress',
  'subnetMask',
  'gateway',
  'macAddress',
  'notes',
] as const;

/**
 * On edit, only send a section when the user actually changed it: the API
 * appends a new location row (with a new `movedAt`) whenever `location` is
 * present, so resending an untouched section would pollute its history.
 */
function buildPayload(
  values: AssetFormValues,
  initialValues: AssetFormValues,
  isEdit: boolean,
): AssetWritePayload {
  const hasLocation = LOCATION_KEYS.some((key) => values[key].trim().length > 0);
  const locationChanged =
    hasLocation &&
    (!isEdit || LOCATION_KEYS.some((key) => values[key].trim() !== initialValues[key].trim()));

  const networkChanged =
    NETWORK_TEXT_KEYS.some((key) => values[key].trim() !== initialValues[key].trim()) ||
    values.connectionStatus !== initialValues.connectionStatus;
  const hasNetwork =
    NETWORK_TEXT_KEYS.some((key) => values[key].trim().length > 0) ||
    values.connectionStatus !== 'UNKNOWN' ||
    (!isEdit ? false : initialValues.connectionStatus !== 'UNKNOWN');
  const includeNetwork = isEdit ? networkChanged : hasNetwork;

  return {
    assetCode: values.assetCode.trim(),
    assetName: values.assetName.trim(),
    assetType: values.assetType,
    status: values.status,
    ...(optional(values.brand) === undefined ? {} : { brand: optional(values.brand) }),
    ...(optional(values.model) === undefined ? {} : { model: optional(values.model) }),
    ...(optional(values.serialNumber) === undefined
      ? {}
      : { serialNumber: optional(values.serialNumber) }),
    ...(optional(values.purchaseDate) === undefined
      ? {}
      : { purchaseDate: optional(values.purchaseDate) }),
    ...(optional(values.warrantyEnd) === undefined
      ? {}
      : { warrantyEnd: optional(values.warrantyEnd) }),
    ...(optional(values.description) === undefined
      ? {}
      : { description: optional(values.description) }),
    ...(locationChanged
      ? {
          location: {
            dataCenter: values.dataCenter.trim(),
            ...(optional(values.rack) === undefined ? {} : { rack: optional(values.rack) }),
            ...(optional(values.rackSlot) === undefined
              ? {}
              : { rackSlot: optional(values.rackSlot) }),
            ...(optional(values.floor) === undefined ? {} : { floor: optional(values.floor) }),
            ...(optional(values.room) === undefined ? {} : { room: optional(values.room) }),
          },
        }
      : {}),
    ...(includeNetwork
      ? {
          network: {
            ...(optional(values.hostname) === undefined
              ? {}
              : { hostname: optional(values.hostname) }),
            ...(optional(values.ipAddress) === undefined
              ? {}
              : { ipAddress: optional(values.ipAddress) }),
            ...(optional(values.subnetMask) === undefined
              ? {}
              : { subnetMask: optional(values.subnetMask) }),
            ...(optional(values.gateway) === undefined
              ? {}
              : { gateway: optional(values.gateway) }),
            ...(optional(values.macAddress) === undefined
              ? {}
              : { macAddress: optional(values.macAddress) }),
            ...(optional(values.notes) === undefined ? {} : { notes: optional(values.notes) }),
            connectionStatus: values.connectionStatus,
          },
        }
      : {}),
  };
}

interface AssetFormProps {
  initial?: AssetWritePayload;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  isEdit?: boolean;
  onSubmit: (payload: AssetWritePayload) => void;
}

export function AssetForm({
  initial,
  submitLabel,
  submitting,
  error,
  isEdit = false,
  onSubmit,
}: AssetFormProps) {
  const initialValues = useMemo(() => toFormValues(initial), [initial]);
  const [values, setValues] = useState<AssetFormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  function setValue<K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function handleSubmit() {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSubmit(buildPayload(values, initialValues, isEdit));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Ionicons color={colors.dangerInk} name="alert-circle" size={18} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormSection title="Umum">
          <FormField
            autoCapitalize="characters"
            error={errors.assetCode}
            hint="Contoh: SRV-005. Huruf, angka, titik, garis bawah, atau strip."
            label="Kode aset *"
            maxLength={30}
            onChangeText={(value) => setValue('assetCode', value)}
            placeholder="SRV-005"
            value={values.assetCode}
          />
          <FormField
            error={errors.assetName}
            label="Nama aset *"
            maxLength={100}
            onChangeText={(value) => setValue('assetName', value)}
            placeholder="Contoh: Backup Server 02"
            value={values.assetName}
          />
          <SelectField
            label="Tipe aset *"
            onChange={(value) => setValue('assetType', value)}
            options={ASSET_TYPE_OPTIONS}
            value={values.assetType}
          />
          <FormField
            error={errors.brand}
            label="Merek"
            maxLength={50}
            onChangeText={(value) => setValue('brand', value)}
            placeholder="Dell, HPE, Cisco..."
            value={values.brand}
          />
          <FormField
            error={errors.model}
            label="Model"
            maxLength={50}
            onChangeText={(value) => setValue('model', value)}
            placeholder="PowerEdge R750"
            value={values.model}
          />
          <FormField
            autoCapitalize="characters"
            error={errors.serialNumber}
            label="Serial number"
            maxLength={100}
            onChangeText={(value) => setValue('serialNumber', value)}
            placeholder="SN-DC-SRV-005"
            value={values.serialNumber}
          />
          <FormField
            autoCapitalize="none"
            error={errors.purchaseDate}
            hint="Format YYYY-MM-DD."
            label="Tanggal pembelian"
            maxLength={10}
            onChangeText={(value) => setValue('purchaseDate', value)}
            placeholder="2025-01-10"
            value={values.purchaseDate}
          />
          <FormField
            autoCapitalize="none"
            error={errors.warrantyEnd}
            hint="Format YYYY-MM-DD."
            label="Garansi sampai"
            maxLength={10}
            onChangeText={(value) => setValue('warrantyEnd', value)}
            placeholder="2028-01-10"
            value={values.warrantyEnd}
          />
          <SelectField
            label="Status"
            onChange={(value) => setValue('status', value)}
            options={ASSET_STATUS_OPTIONS}
            value={values.status}
          />
          <FormField
            error={errors.description}
            label="Deskripsi"
            maxLength={1000}
            multiline
            onChangeText={(value) => setValue('description', value)}
            placeholder="Fungsi aset, catatan pemakaian, dan sebagainya."
            value={values.description}
          />
        </FormSection>

        <FormSection title="Lokasi">
          <FormField
            error={errors.dataCenter}
            hint="Kosongkan semua kolom lokasi bila aset belum ditempatkan."
            label="Data center"
            maxLength={100}
            onChangeText={(value) => setValue('dataCenter', value)}
            placeholder="DC-1"
            value={values.dataCenter}
          />
          <FormField
            label="Rack"
            maxLength={20}
            onChangeText={(value) => setValue('rack', value)}
            placeholder="A"
            value={values.rack}
          />
          <FormField
            label="Slot rack"
            maxLength={20}
            onChangeText={(value) => setValue('rackSlot', value)}
            placeholder="U03"
            value={values.rackSlot}
          />
          <FormField
            label="Lantai"
            maxLength={20}
            onChangeText={(value) => setValue('floor', value)}
            placeholder="1"
            value={values.floor}
          />
          <FormField
            label="Ruangan"
            maxLength={50}
            onChangeText={(value) => setValue('room', value)}
            placeholder="Ruang network (opsional)"
            value={values.room}
          />
        </FormSection>

        <FormSection title="Jaringan">
          <FormField
            autoCapitalize="none"
            error={errors.hostname}
            label="Hostname"
            maxLength={100}
            onChangeText={(value) => setValue('hostname', value)}
            placeholder="backup-srv-02"
            value={values.hostname}
          />
          <FormField
            autoCapitalize="none"
            error={errors.ipAddress}
            keyboardType="numbers-and-punctuation"
            label="Alamat IP"
            maxLength={45}
            onChangeText={(value) => setValue('ipAddress', value)}
            placeholder="192.168.1.20"
            value={values.ipAddress}
          />
          <FormField
            autoCapitalize="none"
            error={errors.subnetMask}
            keyboardType="numbers-and-punctuation"
            label="Subnet mask"
            maxLength={45}
            onChangeText={(value) => setValue('subnetMask', value)}
            placeholder="255.255.255.0"
            value={values.subnetMask}
          />
          <FormField
            autoCapitalize="none"
            error={errors.gateway}
            keyboardType="numbers-and-punctuation"
            label="Gateway"
            maxLength={45}
            onChangeText={(value) => setValue('gateway', value)}
            placeholder="192.168.1.1"
            value={values.gateway}
          />
          <FormField
            autoCapitalize="characters"
            error={errors.macAddress}
            label="MAC address"
            maxLength={17}
            onChangeText={(value) => setValue('macAddress', value)}
            placeholder="AA:BB:CC:00:00:20"
            value={values.macAddress}
          />
          <SelectField
            label="Status koneksi"
            onChange={(value) => setValue('connectionStatus', value)}
            options={CONNECTION_OPTIONS}
            value={values.connectionStatus}
          />
          <FormField
            error={errors.notes}
            label="Catatan jaringan"
            maxLength={500}
            multiline
            onChangeText={(value) => setValue('notes', value)}
            placeholder="VLAN 20, port switch 12..."
            value={values.notes}
          />
        </FormSection>

        {isEdit ? (
          <Text style={styles.editNote}>
            Kolom teks opsional yang dikosongkan dianggap &quot;tidak diubah&quot; oleh API. Sub-field
            lokasi (rak, slot, lantai, ruangan) dapat dihapus selama data center tetap terisi.
          </Text>
        ) : null}

        <Button label={submitLabel} loading={submitting} onPress={handleSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.huge,
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
  editNote: {
    ...text.small,
    paddingHorizontal: spacing.xs,
  },
});
