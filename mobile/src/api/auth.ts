import { api } from './client';
import type { ApiEnvelope, User } from '../types/api';

export interface LoginResult {
  token: string;
  user: User;
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResult> {
  const response = await api.post<ApiEnvelope<LoginResult>>('/api/auth/login', {
    username: username.trim(),
    password,
  });
  return response.data.data;
}
