import { api } from './client';
import type { ApiEnvelope, AppNotification, Paginated } from '../types/api';

export async function fetchNotifications(
  page = 1,
  limit = 20,
): Promise<Paginated<AppNotification>> {
  const response = await api.get<ApiEnvelope<Paginated<AppNotification>>>(
    '/api/notifications',
    { params: { page, limit } },
  );
  return response.data.data;
}
