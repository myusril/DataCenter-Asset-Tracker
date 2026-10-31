import axios, { AxiosError } from 'axios';
import { router } from 'expo-router';

import { useAuthStore } from '../store/auth';

/**
 * The API address comes from `EXPO_PUBLIC_API_URL` only. The fallback is the
 * local development server used by web and the iOS simulator.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const isLoginRequest = url.endsWith('/api/auth/login');
    const activeToken = useAuthStore.getState().token;
    const requestToken = error.config?.headers?.Authorization;
    const belongsToActiveSession =
      requestToken === undefined || requestToken === `Bearer ${activeToken}`;
    if (error.response?.status === 401 && !isLoginRequest && belongsToActiveSession) {
      useAuthStore.getState().logout();
      router.replace('/(auth)/login');
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Turns an axios failure into one readable sentence. Validation errors are
 * joined; a missing response becomes a connection hint instead of a JSON dump.
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.errors?.length) {
      return body.errors.map((item) => item.message).join('. ');
    }
    if (typeof body?.message === 'string' && body.message.length > 0) {
      return body.message;
    }
    if (!error.response) {
      return 'Tidak dapat terhubung ke server. Periksa koneksi dan alamat API.';
    }
    return `Permintaan tidak dapat diproses (kode ${error.response.status}).`;
  }
  return 'Terjadi kesalahan yang tidak terduga.';
}
