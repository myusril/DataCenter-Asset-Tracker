import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from '../api/notifications';

// Push is an optional delivery channel: every failure below is swallowed so a
// denied permission or missing Firebase configuration never blocks login.

const ANDROID_CHANNEL_ID = 'default';

let currentToken: string | null = null;
let registeredToken: string | null = null;
// Incremented on logout. A registration that started before the increment must
// not commit after the session ends, otherwise it would recreate the row the
// logout just deleted.
let generation = 0;
// False from the moment logout starts until a new authenticated registration
// succeeds; blocks token-refresh events from recreating a just-deleted row.
let acceptingRegistrations = false;

// One lifecycle operation at a time: logout waits for an in-flight registration
// before deleting, and a registration cannot slip in behind the deletion.
let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function configurePushNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Notifikasi',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }
  if (!current.canAskAgain) {
    return false;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

async function registerTokenValue(token: string): Promise<void> {
  if (registeredToken === token) {
    return;
  }
  await registerDeviceToken({
    token,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  });
  registeredToken = token;
}

/** Registers the FCM token after login and whenever FCM rotates it. */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const expected = generation;
  try {
    if (!(await ensurePermission()) || expected !== generation) {
      return;
    }

    const device = await Notifications.getDevicePushTokenAsync();
    const token = device.data;
    if (expected !== generation || typeof token !== 'string' || token.length === 0) {
      return;
    }

    currentToken = token;
    acceptingRegistrations = true;
    await enqueue(async () => {
      if (expected !== generation) {
        return;
      }
      await registerTokenValue(token);
    });
  } catch {
    // Missing google-services.json, a simulator, or a backend without push:
    // in-app notifications keep working.
  }
}

/**
 * Removes this device's token before the session is cleared. The backend call
 * runs after any in-flight registration; the native FCM token is then deleted
 * so a failed backend call cannot keep delivering the previous account's
 * notifications (FCM prunes the now-invalid token on the next send).
 */
export async function unregisterPushToken(): Promise<void> {
  generation += 1;
  acceptingRegistrations = false;
  await enqueue(async () => {
    const token = currentToken ?? registeredToken;
    currentToken = null;
    registeredToken = null;

    if (token) {
      try {
        await unregisterDeviceToken(token);
      } catch {
        // The session may already be invalid (e.g. automatic 401 logout).
      }
    }

    try {
      await Notifications.unregisterForNotificationsAsync();
    } catch {
      // Native module unavailable (web) or token already gone.
    }
  });
}

export function subscribeToPushTokenRefresh(): () => void {
  const subscription = Notifications.addPushTokenListener((token) => {
    if (Platform.OS === 'web' || typeof token.data !== 'string') {
      return;
    }
    // Nothing registered in this session, or logout already started.
    if (!acceptingRegistrations) {
      return;
    }

    const expected = generation;
    currentToken = token.data;
    void enqueue(async () => {
      if (expected !== generation) {
        return;
      }
      await registerTokenValue(token.data);
    }).catch(() => undefined);
  });
  return () => subscription.remove();
}
