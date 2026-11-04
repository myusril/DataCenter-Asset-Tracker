import { existsSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Push mirrors the in-app notification rows; it is never the source of truth.
// Delivery problems are logged and must never fail the API request that
// created the row.

export type PushNotificationType = 'AI_ALERT' | 'MAINTENANCE_REMINDER';

export interface PushData {
  type: PushNotificationType;
  deepLink: string;
  assetId?: string;
  maintenanceId?: string;
  predictionId?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  data: PushData;
}

export interface PushDispatchSummary {
  attempted: number;
  success: number;
  pruned: number;
}

export interface PushProvider {
  readonly enabled: boolean;
  sendToUsers(userIds: number[], message: PushMessage): Promise<PushDispatchSummary>;
}

export interface MulticastResponse {
  success: boolean;
  error?: { code?: string };
}

/** The slice of `firebase-admin` messaging used here, injectable for tests. */
export interface MulticastSender {
  sendEachForMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data: Record<string, string>;
  }): Promise<{ responses: MulticastResponse[] }>;
}

const EMPTY_SUMMARY: PushDispatchSummary = { attempted: 0, success: 0, pruned: 0 };
const MAX_TOKENS_PER_REQUEST = 500;

class NoopPushProvider implements PushProvider {
  readonly enabled = false;

  async sendToUsers(): Promise<PushDispatchSummary> {
    return { ...EMPTY_SUMMARY };
  }
}

function isInvalidTokenError(code: string): boolean {
  return (
    code.endsWith('registration-token-not-registered') ||
    code.endsWith('invalid-registration-token') ||
    code.endsWith('invalid-argument')
  );
}

export class FcmPushProvider implements PushProvider {
  readonly enabled = true;

  constructor(private readonly sender: MulticastSender) {}

  async sendToUsers(
    userIds: number[],
    message: PushMessage,
  ): Promise<PushDispatchSummary> {
    if (userIds.length === 0) {
      return { ...EMPTY_SUMMARY };
    }

    const rows = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, token: true },
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) {
      return { ...EMPTY_SUMMARY };
    }

    const data: Record<string, string> = {
      type: message.data.type,
      deepLink: message.data.deepLink,
    };
    for (const key of ['assetId', 'maintenanceId', 'predictionId'] as const) {
      const value = message.data[key];
      if (value !== undefined) {
        data[key] = value;
      }
    }

    let attempted = 0;
    let success = 0;
    const invalidTokenIds: number[] = [];

    for (let start = 0; start < rows.length; start += MAX_TOKENS_PER_REQUEST) {
      const chunk = rows.slice(start, start + MAX_TOKENS_PER_REQUEST);
      const response = await this.sender.sendEachForMulticast({
        tokens: chunk.map((row) => row.token),
        notification: { title: message.title, body: message.body },
        data,
      });

      response.responses.forEach((result, index) => {
        attempted += 1;
        if (result.success) {
          success += 1;
          return;
        }
        const code = result.error?.code ?? '';
        const row = chunk[index];
        if (row && isInvalidTokenError(code)) {
          invalidTokenIds.push(row.id);
        }
      });
    }

    if (invalidTokenIds.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { id: { in: invalidTokenIds } } });
    }

    return { attempted, success, pruned: invalidTokenIds.length };
  }
}

function buildFcmProvider(): PushProvider | null {
  if (!env.PUSH_ENABLED) {
    return null;
  }

  const serviceAccountPath = env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountPath) {
    return null;
  }

  if (!existsSync(serviceAccountPath)) {
    return null;
  }

  try {
    // `cert(path)` reads and validates the JSON itself; the path is never logged.
    const app =
      getApps().length > 0
        ? getApps()[0]!
        : initializeApp({ credential: cert(serviceAccountPath) });
    const messaging = getMessaging(app);
    return new FcmPushProvider({
      sendEachForMulticast: (message) => messaging.sendEachForMulticast(message),
    });
  } catch {
    // Never log the path contents or the credential itself; the caller emits
    // exactly one disabled-provider warning for every failure path.
    return null;
  }
}

let provider: PushProvider | undefined;

/**
 * Resolves the process-wide provider once. Disabled or misconfigured push
 * produces exactly one boot warning and a no-op provider.
 */
export function initPushProvider(): PushProvider {
  if (provider) {
    return provider;
  }
  const fcm = buildFcmProvider();
  if (fcm) {
    provider = fcm;
    logger.info('Push notifications enabled (FCM)');
    return provider;
  }
  logger.warn(
    'Push notifications disabled (PUSH_ENABLED=false or missing service account); in-app notifications only',
  );
  provider = new NoopPushProvider();
  return provider;
}

export function getPushProvider(): PushProvider {
  return provider ?? initPushProvider();
}

/** Test seam: `undefined` forces the next lookup to re-read the environment. */
export function setPushProviderForTests(next: PushProvider | undefined): void {
  provider = next;
}

/**
 * Fire-and-forget dispatch. Callers invoke it after the notification rows are
 * committed so a slow or failing FCM request never blocks or fails the API.
 */
export function dispatchPush(userIds: number[], message: PushMessage): void {
  const active = getPushProvider();
  if (!active.enabled || userIds.length === 0) {
    return;
  }
  void active.sendToUsers(userIds, message).catch((error: unknown) => {
    logger.error(
      `Push dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}
