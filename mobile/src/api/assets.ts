import { api } from './client';
import type {
  ApiEnvelope,
  Asset,
  AssetDetail,
  AssetStatus,
  AssetStatistics,
  AssetType,
  Paginated,
} from '../types/api';

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
