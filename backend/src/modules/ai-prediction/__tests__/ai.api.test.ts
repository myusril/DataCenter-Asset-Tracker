import request from 'supertest';
import type { MaintenanceType } from '@prisma/client';
import { createApp } from '../../../app.js';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
} from '../../../../test/support/database.js';
import {
  auth,
  createAsset,
  createMaintenance,
  createPrediction,
  createUser,
} from '../../../../test/support/fixtures.js';

const app = createApp();

afterAll(disconnectDatabase);

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

async function seedLowRiskAsset() {
  const now = Date.now();
  return createAsset({
    assetCode: 'SRV-900',
    assetName: 'Quiet Server',
    assetType: 'STORAGE',
    status: 'ACTIVE',
    purchaseDate: new Date(now - 10 * DAY_MS),
    createdAt: new Date(now - 10 * DAY_MS),
    network: { connectionStatus: 'ONLINE' },
  });
}

describe('POST /api/ai/predict/:assetId', () => {
  beforeEach(resetDatabase);

  it('reproduces the 83.5 HIGH reference and alerts only active users', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    await createUser({ username: 'gone', isActive: false });
    const asset = await seedReferenceAsset();

    const response = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Prediction generated successfully',
      data: {
        assetId: asset.id,
        assetCode: 'SRV-001',
        riskScore: 83.5,
        riskLevel: 'HIGH',
        confidence: 95,
        predictedFailureDays: 15,
        isActive: true,
        alertsCreated: 2,
        modelVersion: 'v1.0',
      },
    });
    expect(response.body.data.layerBreakdown).toMatchObject({
      layer1: { baseScore: 69.5 },
      layer2: { adjustments: { zScore: 0, trend: 5, interval: 0, peer: 0 }, total: 5 },
      layer3: {
        boosts: { downtimeOffline: 2.5, downtimeRepair: 1.5, repairRatio: 5, daysSince: 0 },
        total: 9,
      },
      final: 83.5,
    });
    expect(response.body.data.explanation).toContain('83.5/100');
    expect(response.body.data.recommendation).toContain('inspeksi');

    const stored = await prisma.aiPrediction.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });
    expect(Number(stored.riskScore)).toBe(83.5);
    expect(stored.isActive).toBe(true);

    const notifications = await prisma.notification.findMany({
      orderBy: { userId: 'asc' },
    });
    expect(notifications).toHaveLength(2);
    expect(notifications.map((row) => row.userId)).toEqual([admin.id, technician.id]);
    expect(notifications.every((row) => row.type === 'AI_ALERT')).toBe(true);
    expect(notifications[0]?.title).toBe('AI Alert: SRV-001 risiko HIGH');
    expect(notifications[0]?.message).toContain('83.5/100 (HIGH)');
    expect(notifications[0]?.predictionId).toBe(response.body.data.id);
  });

  it('deactivates the previous prediction and stores exactly one active row', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await seedReferenceAsset();

    const first = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(admin.token));
    const second = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(admin.token));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);

    const rows = await prisma.aiPrediction.findMany({
      where: { assetId: asset.id },
      orderBy: { id: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.isActive)).toEqual([false, true]);
    expect(rows[1]?.id).toBe(second.body.data.id);
  });

  it('creates no alerts for a LOW prediction', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await seedLowRiskAsset();

    const response = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(201);
    expect(response.body.data.riskLevel).toBe('LOW');
    expect(response.body.data.alertsCreated).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('returns 404, 400, and 403 for missing assets, bad ids, and technicians', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    const asset = await seedLowRiskAsset();

    const missing = await request(app)
      .post('/api/ai/predict/999999')
      .set(auth(admin.token));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Asset not found');

    const invalid = await request(app)
      .post('/api/ai/predict/abc')
      .set(auth(admin.token));
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .post(`/api/ai/predict/${asset.id}`)
      .set(auth(technician.token));
    expect(forbidden.status).toBe(403);
  });
});

describe('GET /api/ai/explain/:assetId', () => {
  beforeEach(resetDatabase);

  it('returns the full assessment without persisting anything', async () => {
    const technician = await createUser({ username: 'tech' });
    const asset = await seedReferenceAsset();

    const response = await request(app)
      .get(`/api/ai/explain/${asset.id}`)
      .set(auth(technician.token));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Risk explanation generated successfully');
    expect(response.body.data).toMatchObject({
      assetId: asset.id,
      riskScore: 83.5,
      riskLevel: 'HIGH',
      confidence: 95,
      predictedFailureDays: 15,
    });
    expect(response.body.data).not.toHaveProperty('id');
    expect(response.body.data).not.toHaveProperty('isActive');
    expect(await prisma.aiPrediction.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('returns 404 for a missing asset', async () => {
    const technician = await createUser({ username: 'tech' });

    const response = await request(app)
      .get('/api/ai/explain/999999')
      .set(auth(technician.token));

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Asset not found');
  });
});

describe('GET /api/ai/predictions', () => {
  beforeEach(async () => {
    await resetDatabase();
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await seedReferenceAsset();
    await seedLowRiskAsset();
    await request(app).post(`/api/ai/predict/${asset.id}`).set(auth(admin.token));
    await request(app).post(`/api/ai/predict/${asset.id}`).set(auth(admin.token));
    const low = await prisma.asset.findUniqueOrThrow({ where: { assetCode: 'SRV-900' } });
    await request(app).post(`/api/ai/predict/${low.id}`).set(auth(admin.token));
  });

  it('lists every prediction newest-first with numeric decimals and asset joins', async () => {
    const technician = await createUser({ username: 'tech' });

    const response = await request(app)
      .get('/api/ai/predictions')
      .set(auth(technician.token));

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    });
    expect(typeof response.body.data.items[0].riskScore).toBe('number');
    expect(response.body.data.items[2].asset.assetCode).toBe('SRV-001');
    const timestamps = response.body.data.items.map((row: { predictedAt: string }) =>
      new Date(row.predictedAt).getTime(),
    );
    expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
    expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[2]);
  });

  it('filters by asset, risk level, and active flag', async () => {
    const technician = await createUser({ username: 'tech' });
    const asset = await prisma.asset.findUniqueOrThrow({ where: { assetCode: 'SRV-001' } });

    const activeForAsset = await request(app)
      .get(`/api/ai/predictions?assetId=${asset.id}&activeOnly=true`)
      .set(auth(technician.token));
    expect(activeForAsset.body.data.pagination.total).toBe(1);
    expect(activeForAsset.body.data.items[0].isActive).toBe(true);
    expect(activeForAsset.body.data.items[0].riskScore).toBe(83.5);

    const high = await request(app)
      .get('/api/ai/predictions?riskLevel=HIGH')
      .set(auth(technician.token));
    expect(high.body.data.pagination.total).toBe(2);

    const inactiveOnly = await request(app)
      .get('/api/ai/predictions?riskLevel=HIGH&activeOnly=false')
      .set(auth(technician.token));
    expect(inactiveOnly.body.data.pagination.total).toBe(1);
    expect(inactiveOnly.body.data.items[0].isActive).toBe(false);

    const history = await request(app)
      .get(`/api/ai/predictions?assetId=${asset.id}`)
      .set(auth(technician.token));
    expect(history.body.data.pagination.total).toBe(2);
  });

  it('paginates and rejects an invalid activeOnly flag', async () => {
    const technician = await createUser({ username: 'tech' });

    const page = await request(app)
      .get('/api/ai/predictions?limit=1&page=2')
      .set(auth(technician.token));
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.pagination.totalPages).toBe(3);

    const invalid = await request(app)
      .get('/api/ai/predictions?activeOnly=yes')
      .set(auth(technician.token));
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors[0].message).toContain('activeOnly');
  });

  it('returns the prediction history for one asset and 404 for a missing asset', async () => {
    const technician = await createUser({ username: 'tech' });
    const asset = await prisma.asset.findUniqueOrThrow({ where: { assetCode: 'SRV-001' } });

    const response = await request(app)
      .get(`/api/ai/predictions/asset/${asset.id}`)
      .set(auth(technician.token));
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0].isActive).toBe(true);
    expect(response.body.data.items[1].isActive).toBe(false);

    const missing = await request(app)
      .get('/api/ai/predictions/asset/999999')
      .set(auth(technician.token));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Asset not found');
  });
});

describe('GET /api/ai/risk-summary', () => {
  beforeEach(resetDatabase);

  it('counts active predictions only and reports the newest prediction timestamp', async () => {
    const technician = await createUser({ username: 'tech' });
    const high = await createAsset({ assetCode: 'S-1' });
    const medium = await createAsset({ assetCode: 'S-2' });
    const inactive = await createAsset({ assetCode: 'S-3' });
    await createAsset({ assetCode: 'S-4' });

    await createPrediction({
      assetId: high.id,
      riskScore: 80,
      riskLevel: 'HIGH',
      predictedAt: new Date('2026-10-01T10:00:00.000Z'),
      predictedFailureDays: 18,
    });
    await createPrediction({
      assetId: medium.id,
      riskScore: 50,
      riskLevel: 'MEDIUM',
      predictedAt: new Date('2026-10-02T10:00:00.000Z'),
      predictedFailureDays: 45,
    });
    await createPrediction({
      assetId: inactive.id,
      riskScore: 10,
      riskLevel: 'LOW',
      predictedAt: new Date('2026-10-03T10:00:00.000Z'),
      isActive: false,
    });

    const response = await request(app)
      .get('/api/ai/risk-summary')
      .set(auth(technician.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      counts: { LOW: 0, MEDIUM: 1, HIGH: 1 },
      averageScore: 65,
      assetsWithoutPrediction: 1,
      lastPredictedAt: '2026-10-03T10:00:00.000Z',
    });
    expect(response.body.data.topRiskAssets).toEqual([
      {
        assetId: high.id,
        assetCode: 'S-1',
        assetName: 'Asset S-1',
        riskScore: 80,
        riskLevel: 'HIGH',
        predictedFailureDays: 18,
        predictedAt: '2026-10-01T10:00:00.000Z',
      },
      {
        assetId: medium.id,
        assetCode: 'S-2',
        assetName: 'Asset S-2',
        riskScore: 50,
        riskLevel: 'MEDIUM',
        predictedFailureDays: 45,
        predictedAt: '2026-10-02T10:00:00.000Z',
      },
    ]);
  });

  it('handles an empty prediction table', async () => {
    const technician = await createUser({ username: 'tech' });
    await createAsset({ assetCode: 'S-9' });

    const response = await request(app)
      .get('/api/ai/risk-summary')
      .set(auth(technician.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      counts: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      averageScore: 0,
      topRiskAssets: [],
      assetsWithoutPrediction: 1,
      lastPredictedAt: null,
    });
  });
});

describe('POST /api/ai/predict-batch', () => {
  beforeEach(resetDatabase);

  it('reports per-asset failures without failing the whole batch', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await seedReferenceAsset();

    const response = await request(app)
      .post('/api/ai/predict-batch')
      .set(auth(admin.token))
      .send({ assetIds: [asset.id, 999999] });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Batch prediction completed');
    expect(response.body.data).toEqual({
      processed: 1,
      high: 1,
      medium: 0,
      low: 0,
      alertsCreated: 1,
      failed: [{ assetId: 999999, message: 'Asset not found' }],
    });
    expect(await prisma.aiPrediction.count({ where: { assetId: asset.id } })).toBe(1);
  });

  it('defaults to every asset when the body is empty', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await seedReferenceAsset();
    await seedLowRiskAsset();

    const response = await request(app)
      .post('/api/ai/predict-batch')
      .set(auth(admin.token))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      processed: 2,
      high: 1,
      low: 1,
      medium: 0,
      failed: [],
    });
    expect(await prisma.aiPrediction.count({ where: { isActive: true } })).toBe(2);
  });

  it('returns 400 for an invalid assetIds payload and 403 for a technician', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });

    const empty = await request(app)
      .post('/api/ai/predict-batch')
      .set(auth(admin.token))
      .send({ assetIds: [] });
    expect(empty.status).toBe(400);

    const malformed = await request(app)
      .post('/api/ai/predict-batch')
      .set(auth(admin.token))
      .send({ assetIds: ['x'] });
    expect(malformed.status).toBe(400);

    const forbidden = await request(app)
      .post('/api/ai/predict-batch')
      .set(auth(technician.token))
      .send({});
    expect(forbidden.status).toBe(403);
  });
});
