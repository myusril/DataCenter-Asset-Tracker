import { api } from './client';
import type { ApiEnvelope, AppNotification, Paginated } from '../types/api';

export interface NotificationListParams {
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export async function fetchNotifications(
  params: NotificationListParams = {},
): Promise<Paginated<AppNotification>> {
  const response = await api.get<ApiEnvelope<Paginated<AppNotification>>>(
    '/api/notifications',
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        ...(params.isRead === undefined ? {} : { isRead: params.isRead }),
      },
    },
  );
  return response.data.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await api.get<ApiEnvelope<{ unreadCount: number }>>(
    '/api/notifications/unread-count',
  );
  return response.data.data.unreadCount;
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const response = await api.put<ApiEnvelope<AppNotification>>(
    `/api/notifications/${id}/read`,
  );
  return response.data.data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await api.put<ApiEnvelope<{ updated: number }>>(
    '/api/notifications/read-all',
  );
  return response.data.data.updated;
}

export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/api/notifications/${id}`);
}

export async function deleteReadNotifications(): Promise<number> {
  const response = await api.delete<ApiEnvelope<{ deleted: number }>>(
    '/api/notifications/read',
  );
  return response.data.data.deleted;
}

export type DevicePlatform = 'ANDROID' | 'IOS';

export interface RegisteredDeviceToken {
  id: number;
  platform: DevicePlatform;
  lastSeenAt: string;
}

export async function registerDeviceToken(input: {
  token: string;
  platform: DevicePlatform;
}): Promise<RegisteredDeviceToken> {
  const response = await api.post<ApiEnvelope<RegisteredDeviceToken>>(
    '/api/notifications/device',
    input,
  );
  return response.data.data;
}

/**
 * Removes one token, or every token of the caller when `token` is omitted.
 * The backend never deletes a token owned by another account.
 */
export async function unregisterDeviceToken(token?: string): Promise<number> {
  const response = await api.delete<ApiEnvelope<{ deleted: number }>>(
    '/api/notifications/device',
    token === undefined ? undefined : { data: { token } },
  );
  return response.data.data.deleted;
}
