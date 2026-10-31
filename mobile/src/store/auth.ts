import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { loginRequest } from '../api/auth';
import { setSessionToken } from '../api/session';
import type { User } from '../types/api';

interface AuthState {
  token: string | null;
  user: User | null;
  isHydrated: boolean;
  isSubmitting: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isHydrated: false,
      isSubmitting: false,

      async login(username, password) {
        set({ isSubmitting: true });
        try {
          const { token, user } = await loginRequest(username, password);
          set({ token, user });
        } finally {
          set({ isSubmitting: false });
        }
      },

      logout() {
        set({ token: null, user: null });
      },

      async loadFromStorage() {
        await useAuthStore.persist.rehydrate();
      },
    }),
    {
      name: 'datacenter-tracker-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ isHydrated: true });
      },
    },
  ),
);

// Keep the HTTP client's token in sync without letting it import this store.
useAuthStore.subscribe((state) => setSessionToken(state.token));
setSessionToken(useAuthStore.getState().token);
