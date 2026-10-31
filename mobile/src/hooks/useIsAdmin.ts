import { useAuthStore } from '../store/auth';

/** Central role gate: every admin-only control reads this, never a local flag. */
export function useIsAdmin(): boolean {
  return useAuthStore((state) => state.user?.role === 'ADMIN');
}
