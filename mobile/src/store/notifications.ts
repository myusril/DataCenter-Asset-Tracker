import { create } from 'zustand';

import { fetchUnreadCount } from '../api/notifications';

interface NotificationState {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  reset: () => void;
}

/**
 * Single source for the unread badge. Screens update it after a mutation and
 * the tab layout re-reads it whenever the app returns to the foreground.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,

  async refreshUnread() {
    try {
      set({ unreadCount: await fetchUnreadCount() });
    } catch {
      // A failed badge refresh must not break navigation; the list screen
      // reports fetch errors on its own.
    }
  },

  reset() {
    set({ unreadCount: 0 });
  },
}));
