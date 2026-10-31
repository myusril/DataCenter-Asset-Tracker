import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../../app.js';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
} from '../../../../test/support/database.js';
import {
  auth,
  createAsset,
  createUser,
} from '../../../../test/support/fixtures.js';

const app = createApp();

afterAll(disconnectDatabase);

const networkPayload = {
  hostname: 'web-srv-01',
  ipAddress: '192.168.1.10',
  subnetMask: '255.255.255.0',
  gateway: '192.168.1.1',
  macAddress: 'AA:BB:CC:00:00:01',
  connectionStatus: 'ONLINE',
  notes: 'VLAN 10',
};

describe('POST /api/network', () => {
  beforeEach(resetDatabase);

  it('creates network information and upserts later calls without clearing fields', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-001' });

    const created = await request(app)
      .post('/api/network')
      .set(auth(admin.token))
      .send({ assetId: asset.id, ...networkPayload });

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      success: true,
      message: 'Network information saved successfully',
      data: {
        assetId: asset.id,
        hostname: 'web-srv-01',
        ipAddress: '192.168.1.10',
        connectionStatus: 'ONLINE',
        asset: { id: asset.id, assetCode: 'SRV-001' },
      },
    });
    const networkId = created.body.data.id;

    const updated = await request(app)
      .post('/api/network')
      .set(auth(admin.token))
      .send({ assetId: asset.id, hostname: 'web-srv-02' });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      id: networkId,
      hostname: 'web-srv-02',
      ipAddress: '192.168.1.10',
      notes: 'VLAN 10',
    });
    expect(await prisma.networkInformation.count()).toBe(1);
  });

  it('returns 404 for an unknown asset and 400 for invalid fields', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });

    const missing = await request(app)
      .post('/api/network')
      .set(auth(admin.token))
      .send({ assetId: 999999, hostname: 'ghost' });
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Asset not found');

    const invalid = await request(app)
      .post('/api/network')
      .set(auth(admin.token))
      .send({ connectionStatus: 'MAYBE', macAddress: 'AA:BB:CC:00:00:01:99' });
    expect(invalid.status).toBe(400);
    const fields = invalid.body.errors.map((issue: { field: string }) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['assetId', 'connectionStatus', 'macAddress']));
  });

  it('returns 403 for a technician and 401 without a token', async () => {
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-002' });

    const forbidden = await request(app)
      .post('/api/network')
      .set(auth(technician.token))
      .send({ assetId: asset.id, hostname: 'x' });
    expect(forbidden.status).toBe(403);

    const anonymous = await request(app)
      .post('/api/network')
      .send({ assetId: asset.id, hostname: 'x' });
    expect(anonymous.status).toBe(401);
  });
});

describe('GET /api/network', () => {
  beforeEach(async () => {
    await resetDatabase();
    const first = await createAsset({
      assetCode: 'SRV-010',
      network: { hostname: 'alpha-host', ipAddress: '10.0.0.1', connectionStatus: 'ONLINE' },
    });
    const second = await createAsset({
      assetCode: 'SRV-011',
      network: { hostname: 'beta-host', ipAddress: '10.0.0.2', connectionStatus: 'OFFLINE' },
    });
    await createAsset({ assetCode: 'SRV-012' });
    expect(first.networkInformation?.id).toBeDefined();
    expect(second.networkInformation?.id).toBeDefined();
  });

  it('lists network rows oldest-first with joined assets and pagination', async () => {
    const tech = await createUser({ username: 'tech' });

    const response = await request(app).get('/api/network').set(auth(tech.token));

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.data.items.map((row: { hostname: string }) => row.hostname)).toEqual([
      'alpha-host',
      'beta-host',
    ]);
    expect(response.body.data.items[0].asset.assetCode).toBe('SRV-010');
  });

  it('filters by connection status and case-insensitive hostname/IP search', async () => {
    const tech = await createUser({ username: 'tech' });

    const status = await request(app)
      .get('/api/network?connectionStatus=OFFLINE')
      .set(auth(tech.token));
    expect(status.body.data.pagination.total).toBe(1);
    expect(status.body.data.items[0].hostname).toBe('beta-host');

    const search = await request(app)
      .get('/api/network?search=10.0.0.1')
      .set(auth(tech.token));
    expect(search.body.data.pagination.total).toBe(1);

    const page = await request(app)
      .get('/api/network?limit=1&page=2')
      .set(auth(tech.token));
    expect(page.body.data.items[0].hostname).toBe('beta-host');
    expect(page.body.data.pagination.totalPages).toBe(2);

    const invalid = await request(app)
      .get('/api/network?limit=101')
      .set(auth(tech.token));
    expect(invalid.status).toBe(400);
  });
});

describe('GET /api/network/statistics', () => {
  beforeEach(resetDatabase);

  it('counts connection statuses and checks within 24 hours', async () => {
    const tech = await createUser({ username: 'tech' });
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await createAsset({
      assetCode: 'N-1',
      network: { connectionStatus: 'ONLINE', lastChecked: now },
    });
    await createAsset({
      assetCode: 'N-2',
      network: { connectionStatus: 'OFFLINE', lastChecked: twoDaysAgo },
    });
    await createAsset({
      assetCode: 'N-3',
      network: { connectionStatus: 'UNKNOWN' },
    });

    const response = await request(app)
      .get('/api/network/statistics')
      .set(auth(tech.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      total: 3,
      byConnectionStatus: { ONLINE: 1, OFFLINE: 1, UNKNOWN: 1 },
      lastCheckedWithin24h: 1,
    });
  });
});

describe('GET /api/network by asset and id', () => {
  beforeEach(resetDatabase);

  it('returns the row for an asset and distinguishes the two 404 cases', async () => {
    const tech = await createUser({ username: 'tech' });
    const withNetwork = await createAsset({
      assetCode: 'SRV-020',
      network: { hostname: 'known-host', connectionStatus: 'ONLINE' },
    });
    const withoutNetwork = await createAsset({ assetCode: 'SRV-021' });

    const found = await request(app)
      .get(`/api/network/asset/${withNetwork.id}`)
      .set(auth(tech.token));
    expect(found.status).toBe(200);
    expect(found.body.data.hostname).toBe('known-host');

    const noRow = await request(app)
      .get(`/api/network/asset/${withoutNetwork.id}`)
      .set(auth(tech.token));
    expect(noRow.status).toBe(404);
    expect(noRow.body.message).toBe('Network information not found for this asset');

    const noAsset = await request(app)
      .get('/api/network/asset/999999')
      .set(auth(tech.token));
    expect(noAsset.status).toBe(404);
    expect(noAsset.body.message).toBe('Asset not found');

    const invalid = await request(app)
      .get('/api/network/asset/abc')
      .set(auth(tech.token));
    expect(invalid.status).toBe(400);
  });

  it('returns a row by id, 404 for missing, and 400 for a bad id', async () => {
    const tech = await createUser({ username: 'tech' });
    const asset = await createAsset({
      assetCode: 'SRV-022',
      network: { hostname: 'by-id' },
    });
    const networkId = asset.networkInformation?.id;

    const response = await request(app)
      .get(`/api/network/${networkId}`)
      .set(auth(tech.token));
    expect(response.status).toBe(200);
    expect(response.body.data.hostname).toBe('by-id');

    const missing = await request(app)
      .get('/api/network/999999')
      .set(auth(tech.token));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Network information not found');

    const invalid = await request(app)
      .get('/api/network/abc')
      .set(auth(tech.token));
    expect(invalid.status).toBe(400);
  });
});

describe('PUT /api/network/:id', () => {
  beforeEach(resetDatabase);

  it('updates only the provided fields', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({
      assetCode: 'SRV-030',
      network: { hostname: 'keep-me', ipAddress: '10.1.1.1', connectionStatus: 'ONLINE' },
    });
    const networkId = asset.networkInformation?.id;

    const response = await request(app)
      .put(`/api/network/${networkId}`)
      .set(auth(admin.token))
      .send({ hostname: 'renamed', notes: 'after audit' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Network information updated successfully');
    expect(response.body.data).toMatchObject({
      hostname: 'renamed',
      ipAddress: '10.1.1.1',
      connectionStatus: 'ONLINE',
      notes: 'after audit',
    });
  });

  it('returns 404, 400, and 403', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-031', network: { hostname: 'x' } });
    const networkId = asset.networkInformation?.id;

    const missing = await request(app)
      .put('/api/network/999999')
      .set(auth(admin.token))
      .send({ hostname: 'y' });
    expect(missing.status).toBe(404);

    const invalid = await request(app)
      .put(`/api/network/${networkId}`)
      .set(auth(admin.token))
      .send({ connectionStatus: 'LINK_DOWN' });
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .put(`/api/network/${networkId}`)
      .set(auth(technician.token))
      .send({ hostname: 'y' });
    expect(forbidden.status).toBe(403);
  });
});

describe('POST /api/network/:id/check', () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the randomised ONLINE and OFFLINE outcomes with lastChecked', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({
      assetCode: 'SRV-040',
      network: { hostname: 'checked', connectionStatus: 'UNKNOWN', lastChecked: null },
    });
    const networkId = asset.networkInformation?.id;

    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const online = await request(app)
      .post(`/api/network/${networkId}/check`)
      .set(auth(admin.token));
    expect(online.status).toBe(200);
    expect(online.body.message).toBe('Connection check completed');
    expect(online.body.data.connectionStatus).toBe('ONLINE');
    expect(online.body.data.lastChecked).toEqual(expect.any(String));
    const firstCheck = new Date(online.body.data.lastChecked).getTime();

    jest.spyOn(Math, 'random').mockReturnValue(0.95);
    const offline = await request(app)
      .post(`/api/network/${networkId}/check`)
      .set(auth(admin.token));
    expect(offline.body.data.connectionStatus).toBe('OFFLINE');

    const stored = await prisma.networkInformation.findUniqueOrThrow({
      where: { id: networkId },
    });
    expect(stored.lastChecked).not.toBeNull();
    expect(stored.lastChecked?.getTime()).toBeGreaterThanOrEqual(firstCheck);
  });

  it('returns 404 for a missing row and 403 for a technician', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-041', network: { hostname: 'x' } });
    const networkId = asset.networkInformation?.id;

    const missing = await request(app)
      .post('/api/network/999999/check')
      .set(auth(admin.token));
    expect(missing.status).toBe(404);

    const forbidden = await request(app)
      .post(`/api/network/${networkId}/check`)
      .set(auth(technician.token));
    expect(forbidden.status).toBe(403);
  });
});

describe('DELETE /api/network/:id', () => {
  beforeEach(resetDatabase);

  it('deletes the row and returns 404 afterwards', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-050', network: { hostname: 'bye' } });
    const networkId = asset.networkInformation?.id;

    const response = await request(app)
      .delete(`/api/network/${networkId}`)
      .set(auth(admin.token));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Network information deleted successfully',
      data: null,
    });
    expect(await prisma.networkInformation.count()).toBe(0);

    const missing = await request(app)
      .delete(`/api/network/${networkId}`)
      .set(auth(admin.token));
    expect(missing.status).toBe(404);
  });

  it('returns 403 for a technician', async () => {
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-051', network: { hostname: 'x' } });
    const networkId = asset.networkInformation?.id;

    const forbidden = await request(app)
      .delete(`/api/network/${networkId}`)
      .set(auth(technician.token));
    expect(forbidden.status).toBe(403);
  });
});
