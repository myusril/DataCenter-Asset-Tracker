import axios from 'axios';

import { api, extractErrorMessage, type ApiErrorBody } from './client';
import type {
  ApiEnvelope,
  Asset,
  AssetDetail,
  AssetStatus,
  AssetStatistics,
  AssetType,
  ConnectionStatus,
  Paginated,
} from '../types/api';

export interface AssetLocationPayload {
  dataCenter: string;
  rack?: string;
  rackSlot?: string;
  floor?: string;
  room?: string;
}

export interface AssetNetworkPayload {
  hostname?: string;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
  macAddress?: string;
  connectionStatus?: ConnectionStatus;
  notes?: string;
}

export interface AssetWritePayload {
  assetCode?: string;
  assetName?: string;
  assetType?: AssetType;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyEnd?: string;
  status?: AssetStatus;
  description?: string;
  location?: AssetLocationPayload;
  network?: AssetNetworkPayload;
}

export async function createAsset(payload: AssetWritePayload): Promise<AssetDetail> {
  const response = await api.post<ApiEnvelope<AssetDetail>>('/api/assets', payload);
  return response.data.data;
}

export async function updateAsset(
  id: number,
  payload: AssetWritePayload,
): Promise<AssetDetail> {
  const response = await api.put<ApiEnvelope<AssetDetail>>(`/api/assets/${id}`, payload);
  return response.data.data;
}

export async function deleteAsset(id: number): Promise<void> {
  await api.delete(`/api/assets/${id}`);
}

/**
 * Turns asset mutation failures into Indonesian sentences. The API answers
 * 409 for duplicate codes/serials and for assets that still have history;
 * both would otherwise surface as raw English messages.
 */
export function describeAssetError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      return 'Hanya administrator yang boleh mengubah data aset.';
    }
    if (error.response?.status === 409) {
      const body = error.response.data as ApiErrorBody | undefined;
      const message = body?.message ?? '';
      if (message.includes('asset code')) {
        return 'Kode aset sudah dipakai aset lain. Gunakan kode yang berbeda.';
      }
      if (message.includes('serial number')) {
        return 'Serial number sudah dipakai aset lain. Periksa kembali nomor seri.';
      }
      if (message.includes('history')) {
        return 'Aset ini masih memiliki riwayat maintenance atau prediksi, sehingga tidak bisa dihapus. Hapus atau arsipkan data terkait lebih dulu.';
      }
    }
  }
  return extractErrorMessage(error);
}

export interface AssetListParams {
  search?: string;
  type?: AssetType | null;
  status?: AssetStatus | null;
  page?: number;
  limit?: number;
}

export async function fetchAssetStatistics(): Promise<AssetStatistics> {
  const response = await api.get<ApiEnvelope<AssetStatistics>>('/api/assets/statistics');
  return response.data.data;
}

export async function fetchAssets(params: AssetListParams): Promise<Paginated<Asset>> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    sortBy: 'assetCode',
    order: 'asc',
  };
  if (params.search) {
    query.search = params.search;
  }
  if (params.type) {
    query.type = params.type;
  }
  if (params.status) {
    query.status = params.status;
  }

  const response = await api.get<ApiEnvelope<Paginated<Asset>>>('/api/assets', {
    params: query,
  });
  return response.data.data;
}

export async function fetchAssetDetail(id: number): Promise<AssetDetail> {
  const response = await api.get<ApiEnvelope<AssetDetail>>(`/api/assets/${id}`);
  return response.data.data;
}
