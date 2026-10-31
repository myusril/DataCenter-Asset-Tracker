import { api } from './client';
import type { ApiEnvelope, MaintenanceRecord } from '../types/api';

export async function fetchAssetMaintenance(assetId: number): Promise<MaintenanceRecord[]> {
  const response = await api.get<ApiEnvelope<{ items: MaintenanceRecord[] }>>(
    `/api/maintenance/asset/${assetId}`,
  );
  return response.data.data.items;
}
