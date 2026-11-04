import { api } from './client';
import type { ApiEnvelope, User } from '../types/api';

export interface UpdateProfileInput {
  fullName?: string;
  email?: string;
  password?: string;
  currentPassword?: string;
}

/**
 * `PATCH /api/users/me` — self-service profile update. Only the fields present
 * in `input` change; the backend rejects anything else.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const response = await api.patch<ApiEnvelope<{ user: User }>>('/api/users/me', input);
  return response.data.data.user;
}
