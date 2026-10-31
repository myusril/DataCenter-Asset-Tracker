import { api } from './client';
import type {
  ApiEnvelope,
  MaintenanceRecord,
  MaintenanceType,
  Paginated,
} from '../types/api';

export interface MaintenanceListParams {
  type?: MaintenanceType | null;
  page?: number;
  limit?: number;
}

export interface MaintenanceCreatePayload {
  assetId: number;
  technicianId?: number;
  maintenanceType: MaintenanceType;
  maintenanceDate: string;
  description?: string;
  result?: string;
  cost?: number;
  nextSchedule?: string;
}

export async function fetchAssetMaintenance(assetId: number): Promise<MaintenanceRecord[]> {
  const response = await api.get<ApiEnvelope<{ items: MaintenanceRecord[] }>>(
    `/api/maintenance/asset/${assetId}`,
  );
  return response.data.data.items;
}

export async function fetchMaintenanceList(
  params: MaintenanceListParams,
): Promise<Paginated<MaintenanceRecord>> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.type) {
    query.type = params.type;
  }

  const response = await api.get<ApiEnvelope<Paginated<MaintenanceRecord>>>(
    '/api/maintenance',
    { params: query },
  );
  return response.data.data;
}

export async function fetchMaintenanceDetail(id: number): Promise<MaintenanceRecord> {
  const response = await api.get<ApiEnvelope<MaintenanceRecord>>(`/api/maintenance/${id}`);
  return response.data.data;
}

export async function createMaintenanceRecord(
  payload: MaintenanceCreatePayload,
): Promise<MaintenanceRecord> {
  const response = await api.post<ApiEnvelope<MaintenanceRecord>>(
    '/api/maintenance',
    payload,
  );
  return response.data.data;
}
