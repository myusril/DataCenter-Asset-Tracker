import { jest } from '@jest/globals';
import request from 'supertest';
import type { MaintenanceType } from '@prisma/client';

import { createApp } from '../../../app.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
} from '../../../../test/support/database.js';
import {
  auth,
  createAsset,
  createMaintenance,
  createUser,
} from '../../../../test/support/fixtures.js';
import { createMaintenanceReminders } from '../../maintenance/maintenance.service.js';
import {
  FcmPushProvider,
  initPushProvider,
  setPushProviderForTests,
  type MulticastSender,
  type PushDispatchSummary,
  type PushMessage,
  type PushProvider,
} from '../push.provider.js';

const app = createApp();

const TOKEN = 'fcm-token-1234567890abcdef';
const OTHER_TOKEN = 'fcm-token-0987654321zyxwvu';

afterAll(disconnectDatabase);

function useMockProvider() {
  const sendToUsers = jest
    .fn<(userIds: number[], message: PushMessage) => Promise<PushDispatchSummary>>()
    .mockResolvedValue({ attempted: 1, success: 1, pruned: 0 });
  const provider: PushProvider = { enabled: true, sendToUsers };
  setPushProviderForTests(provider);
  return sendToUsers;
}

describe('device token endpoints', () => {
  beforeEach(resetDatabase);
  afterEach(() => setPushProviderForTests(undefined));

  it('registers a token idempotently and reassigns it to the signing-in user', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const other = await createUser({ username: 'other' });

    const first = await request(app)
      .post('/api/notifications/device')
      .set(auth(admin.token))
      .send({ token: TOKEN, platform: 'ANDROID' });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      success: true,
      message: 'Device token registered successfully',
      data: { id: expect.any(Number), platform: 'ANDROID', lastSeenAt: expect.any(String) },
    });
    const tokenId = first.body.data.id as number;
    expect(await prisma.deviceToken.count()).toBe(1);

    const repeat = await request(app)
      .post('/api/notifications/device')
      .set(auth(admin.token))
      .send({ token: TOKEN, platform: 'IOS' });

    expect(repeat.status).toBe(200);
    expect(repeat.body.data.id).toBe(tokenId);
    expect(repeat.body.data.platform).toBe('IOS');
    expect(await prisma.deviceToken.count()).toBe(1);

    const reassigned = await request(app)
      .post('/api/notifications/device')
      .set(auth(other.token))
      .send({ token: TOKEN, platform: 'ANDROID' });

    expect(reassigned.status).toBe(200);
    expect(reassigned.body.data.id).toBe(tokenId);
    expect(await prisma.deviceToken.count()).toBe(1);
    expect(
      await prisma.deviceToken.findUniqueOrThrow({ where: { token: TOKEN } }),
    ).toMatchObject({ id: tokenId, userId: other.id });
  });

  it('validates the body and rejects anonymous callers', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });

    for (const body of [
      { token: 'short', platform: 'ANDROID' },
      { token: TOKEN, platform: 'WINDOWS' },
      { platform: 'ANDROID' },
    ]) {
      const invalid = await request(app)
        .post('/api/notifications/device')
        .set(auth(admin.token))
        .send(body);
      expect(invalid.status).toBe(400);
      expect(invalid.body.message).toBe('Validation failed');
    }

    const anonymous = await request(app)
      .post('/api/notifications/device')
      .send({ token: TOKEN, platform: 'ANDROID' });
    expect(anonymous.status).toBe(401);
  });

  it('deletes only tokens owned by the caller, one or all', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const other = await createUser({ username: 'other' });

    for (const [token, user] of [
      [TOKEN, admin],
      [OTHER_TOKEN, admin],
    ] as const) {
      await request(app)
        .post('/api/notifications/device')
        .set(auth(user.token))
        .send({ token, platform: 'ANDROID' });
    }
    const foreignToken = 'fcm-token-foreign-user-123456';
    await request(app)
      .post('/api/notifications/device')
      .set(auth(other.token))
      .send({ token: foreignToken, platform: 'ANDROID' });

    const single = await request(app)
      .delete('/api/notifications/device')
      .set(auth(admin.token))
      .send({ token: TOKEN });
    expect(single.status).toBe(200);
    expect(single.body.data).toEqual({ deleted: 1 });

    const foreign = await request(app)
      .delete('/api/notifications/device')
      .set(auth(admin.token))
      .send({ token: foreignToken });
    expect(foreign.status).toBe(200);
    expect(foreign.body.data).toEqual({ deleted: 0 });
    expect(
      await prisma.deviceToken.count({ where: { token: foreignToken } }),
    ).toBe(1);

    const all = await request(app)
      .delete('/api/notifications/device')
      .set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.data).toEqual({ deleted: 1 });
    expect(await prisma.deviceToken.count()).toBe(1);
    expect(
      await prisma.deviceToken.findUniqueOrThrow({ where: { token: foreignToken } }),
    ).toMatchObject({ userId: other.id });

    const invalid = await request(app)
      .delete('/api/notifications/device')
      .set(auth(admin.token))
      .send({ token: 'short' });
    expect(invalid.status).toBe(400);

    const anonymous = await request(app).delete('/api/notifications/device');
    expect(anonymous.status).toBe(401);
  });
});

describe('push dispatch', () => {
  beforeEach(resetDatabase);
  afterEach(() => setPushProviderForTests(undefined));

  it('sends an AI_ALERT push after a HIGH prediction is committed', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    await createUser({ username: 'gone', isActive: false });
    const asset = await seedReferenceAsset();
    const sendToUsers = useMockProvider();

    const response = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(201);
    expect(response.body.data.riskLevel).toBe('HIGH');
    expect(sendToUsers).toHaveBeenCalledTimes(1);
    const [recipients, message] = sendToUsers.mock.calls[0] as [number[], PushMessage];
    expect(recipients).toEqual([admin.id, technician.id]);
    expect(message.title).toBe('AI Alert: SRV-001 risiko HIGH');
    expect(message.body).toContain('83.5/100 (HIGH)');
    expect(message.data).toEqual({
      type: 'AI_ALERT',
      assetId: String(asset.id),
      predictionId: String(response.body.data.id),
      deepLink: `/asset/${asset.id}`,
    });
  });

  it('does not push for a LOW prediction', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const now = Date.now();
    const asset = await createAsset({
      assetCode: 'SRV-900',
      assetName: 'Quiet Server',
      assetType: 'STORAGE',
      status: 'ACTIVE',
      purchaseDate: new Date(now - 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      network: { connectionStatus: 'ONLINE' },
    });
    const sendToUsers = useMockProvider();

    const response = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(201);
    expect(response.body.data.riskLevel).toBe('LOW');
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('pushes only reminders created by the current run', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-200', assetName: 'DB Server 02' });
    const maintenance = await createMaintenance({
      assetId: asset.id,
      maintenanceDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      result: 'OK',
      nextSchedule: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    const sendToUsers = useMockProvider();

    const first = await createMaintenanceReminders();
    expect(first.created).toBe(2);
    expect(sendToUsers).toHaveBeenCalledTimes(1);
    const [recipients, message] = sendToUsers.mock.calls[0] as [number[], PushMessage];
    expect(recipients).toHaveLength(2);
    expect(message.title).toBe('Pengingat maintenance: SRV-200');
    expect(message.data).toEqual({
      type: 'MAINTENANCE_REMINDER',
      assetId: String(asset.id),
      maintenanceId: String(maintenance.id),
      deepLink: `/maintenance/${maintenance.id}`,
    });

    const second = await createMaintenanceReminders();
    expect(second).toEqual({ scanned: 1, created: 0, skipped: 2 });
    expect(sendToUsers).toHaveBeenCalledTimes(1);
  });
});

describe('FCM provider', () => {
  beforeEach(resetDatabase);

  it('prunes tokens FCM reports as unregistered or invalid', async () => {
    const user = await createUser({ username: 'admin', role: 'ADMIN' });
    const valid = await prisma.deviceToken.create({
      data: { userId: user.id, token: TOKEN, platform: 'ANDROID' },
    });
    await prisma.deviceToken.create({
      data: { userId: user.id, token: 'fcm-token-unregistered-1234', platform: 'ANDROID' },
    });
    await prisma.deviceToken.create({
      data: { userId: user.id, token: 'fcm-token-invalid-argument-12', platform: 'ANDROID' },
    });

    const sender: MulticastSender = {
      sendEachForMulticast: jest
        .fn<MulticastSender['sendEachForMulticast']>()
        .mockResolvedValue({
          responses: [
            { success: true },
            { success: false, error: { code: 'messaging/registration-token-not-registered' } },
            { success: false, error: { code: 'messaging/invalid-argument' } },
          ],
        }),
    };
    const provider = new FcmPushProvider(sender);

    const summary = await provider.sendToUsers([user.id], {
      title: 'AI Alert',
      body: 'Body',
      data: { type: 'AI_ALERT', assetId: '1', deepLink: '/asset/1' },
    });

    expect(summary).toEqual({ attempted: 3, success: 1, pruned: 2 });
    expect(sender.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: [TOKEN, 'fcm-token-unregistered-1234', 'fcm-token-invalid-argument-12'],
      notification: { title: 'AI Alert', body: 'Body' },
      data: { type: 'AI_ALERT', deepLink: '/asset/1', assetId: '1' },
    });
    const remaining = await prisma.deviceToken.findMany({ select: { id: true } });
    expect(remaining.map((row) => row.id)).toEqual([valid.id]);
    expect(await prisma.deviceToken.count()).toBe(1);
  });

  it('keeps tokens when FCM reports a transient failure', async () => {
    const user = await createUser({ username: 'admin', role: 'ADMIN' });
    await prisma.deviceToken.create({
      data: { userId: user.id, token: TOKEN, platform: 'ANDROID' },
    });
    const provider = new FcmPushProvider({
      sendEachForMulticast: jest
        .fn<MulticastSender['sendEachForMulticast']>()
        .mockResolvedValue({
          responses: [{ success: false, error: { code: 'messaging/internal-error' } }],
        }),
    });

    const summary = await provider.sendToUsers([user.id], {
      title: 'Title',
      body: 'Body',
      data: { type: 'AI_ALERT', deepLink: '/asset/1' },
    });

    expect(summary).toEqual({ attempted: 1, success: 0, pruned: 0 });
    expect(await prisma.deviceToken.count()).toBe(1);
  });
});

describe('disabled provider', () => {
  afterEach(() => setPushProviderForTests(undefined));

  it('stays a no-op when PUSH_ENABLED is false', async () => {
    setPushProviderForTests(undefined);
    const provider = initPushProvider();

    expect(provider.enabled).toBe(false);
    await expect(
      provider.sendToUsers([1], {
        title: 'Title',
        body: 'Body',
        data: { type: 'AI_ALERT', deepLink: '/asset/1' },
      }),
    ).resolves.toEqual({ attempted: 0, success: 0, pruned: 0 });
  });

  it('stays a no-op and warns once when the service account file is missing', () => {
    const previousEnabled = env.PUSH_ENABLED;
    const previousPath = env.FIREBASE_SERVICE_ACCOUNT;
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    setPushProviderForTests(undefined);
    try {
      env.PUSH_ENABLED = true;
      env.FIREBASE_SERVICE_ACCOUNT = '/nonexistent/firebase-service-account.json';
      const provider = initPushProvider();
      expect(provider.enabled).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      env.PUSH_ENABLED = previousEnabled;
      env.FIREBASE_SERVICE_ACCOUNT = previousPath;
      setPushProviderForTests(undefined);
      warn.mockRestore();
    }
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** The worked example from the source document (§6.3), seeded in the database. */
async function seedReferenceAsset() {
  const now = Date.now();
  const asset = await createAsset({
    assetCode: 'SRV-001',
    assetName: 'WEB Server 01',
    assetType: 'SERVER',
    status: 'MAINTENANCE',
    purchaseDate: new Date(now - 547 * DAY_MS),
    createdAt: new Date(now - 547 * DAY_MS),
    network: { connectionStatus: 'OFFLINE' },
  });

  const rows: Array<[MaintenanceType, number, string]> = [
    ['REPAIR', 10, 'In progress'],
    ['REPAIR', 25, 'In progress'],
    ['REPAIR', 40, 'In progress'],
    ['ROUTINE', 70, 'OK'],
    ['REPAIR', 85, 'In progress'],
  ];
  for (const [maintenanceType, daysAgo, result] of rows) {
    await createMaintenance({
      assetId: asset.id,
      maintenanceType,
      maintenanceDate: new Date(now - daysAgo * DAY_MS),
      result,
    });
  }

  return asset;
}
