import { api } from './client';
import type {
  ApiEnvelope,
  ConnectionStatus,
  NetworkRecord,
  Paginated,
} from '../types/api';

export interface NetworkListParams {
  search?: string;
  connectionStatus?: ConnectionStatus | null;
  page?: number;
  limit?: number;
}

export async function fetchNetworkList(
  params: NetworkListParams,
): Promise<Paginated<NetworkRecord>> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.search) {
    query.search = params.search;
  }
  if (params.connectionStatus) {
    query.connectionStatus = params.connectionStatus;
  }

  const response = await api.get<ApiEnvelope<Paginated<NetworkRecord>>>('/api/network', {
    params: query,
  });
  return response.data.data;
}

/**
 * Simulated connectivity check on the server; the response is the updated
 * network row including the new `lastChecked` timestamp.
 */
export async function checkNetworkConnection(id: number): Promise<NetworkRecord> {
  const response = await api.post<ApiEnvelope<NetworkRecord>>(`/api/network/${id}/check`);
  return response.data.data;
}
