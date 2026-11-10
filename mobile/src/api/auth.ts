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

export interface RegisterResult {
  user: User;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

export async function registerRequest(
  payload: RegisterPayload,
): Promise<RegisterResult> {
  const response = await api.post<ApiEnvelope<RegisterResult>>('/api/auth/register', {
    username: payload.username.trim(),
    email: payload.email.trim(),
    password: payload.password,
    fullName: payload.fullName.trim(),
  });
  return response.data.data;
}
