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
  createMaintenance,
  createPrediction,
  createUser,
} from '../../../../test/support/fixtures.js';

const app = createApp();

afterAll(disconnectDatabase);

const createPayload = {
  assetCode: 'SRV-002',
  assetName: 'DB Server',
  assetType: 'SERVER',
  brand: 'HPE',
  model: 'ProLiant DL380',
  serialNumber: 'SN-002',
  purchaseDate: '2025-01-10',
  warrantyEnd: '2028-01-10',
  description: 'Database server',
  location: { dataCenter: 'DC-1', rack: 'B', rackSlot: 'U10', floor: '1', room: 'R1' },
  network: {
    hostname: 'db-srv',
    ipAddress: '10.0.0.5',
    subnetMask: '255.255.255.0',
    gateway: '10.0.0.1',
    macAddress: 'AA:BB:CC:00:00:10',
    connectionStatus: 'ONLINE',
    notes: 'VLAN 20',
  },
};

describe('POST /api/assets', () => {
  beforeEach(resetDatabase);

  it('creates an asset with location and network in one request', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/assets')
      .set(auth(admin.token))
      .send(createPayload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Asset created successfully',
      data: {
        assetCode: 'SRV-002',
        assetName: 'DB Server',
        assetType: 'SERVER',
        status: 'ACTIVE',
        createdBy: admin.id,
        purchaseDate: '2025-01-10',
        warrantyEnd: '2028-01-10',
        maintenanceCount: 0,
        latestPrediction: null,
        creator: { id: admin.id, username: 'admin' },
        location: {
          dataCenter: 'DC-1',
          rack: 'B',
          rackSlot: 'U10',
          room: 'R1',
          isCurrent: true,
        },
        network: {
          hostname: 'db-srv',
          ipAddress: '10.0.0.5',
          macAddress: 'AA:BB:CC:00:00:10',
          connectionStatus: 'ONLINE',
        },
      },
    });
    expect(response.body.data.locationHistory).toHaveLength(1);
    expect(typeof response.body.data.id).toBe('number');

    const stored = await prisma.asset.findUniqueOrThrow({
      where: { assetCode: 'SRV-002' },
      include: { locations: true, networkInformation: true },
    });
    expect(stored.createdBy).toBe(admin.id);
    expect(stored.locations).toHaveLength(1);
    expect(stored.networkInformation?.hostname).toBe('db-srv');
  });

  it('leaves location and network null when they are omitted', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/assets')
      .set(auth(admin.token))
      .send({ assetCode: 'SW-009', assetName: 'Access Switch', assetType: 'SWITCH' });

    expect(response.status).toBe(201);
    expect(response.body.data.location).toBeNull();
    expect(response.body.data.network).toBeNull();
    expect(response.body.data.locationHistory).toEqual([]);
    expect(response.body.data.purchaseDate).toBeNull();
  });

  it('returns 409 for a duplicate asset code and leaves the table unchanged', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await createAsset({ assetCode: 'SRV-002' });

    const response = await request(app)
      .post('/api/assets')
      .set(auth(admin.token))
      .send({ ...createPayload, serialNumber: 'SN-OTHER' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: 'An asset with this asset code already exists',
      errors: [{ field: 'assetCode', message: 'An asset with this asset code already exists' }],
    });
    expect(await prisma.asset.count()).toBe(1);
  });

  it('returns 409 for a duplicate serial number', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await createAsset({ assetCode: 'SRV-001', serialNumber: 'SN-002' });

    const response = await request(app)
      .post('/api/assets')
      .set(auth(admin.token))
      .send(createPayload);

    expect(response.status).toBe(409);
    expect(response.body.errors).toEqual([
      { field: 'serialNumber', message: 'An asset with this serial number already exists' },
    ]);
  });

  it('returns 400 with field issues for invalid input', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });

    const response = await request(app)
      .post('/api/assets')
      .set(auth(admin.token))
      .send({
        assetCode: 'bad code!',
        assetName: '',
        assetType: 'DESKTOP',
        purchaseDate: '10-01-2025',
        location: { dataCenter: '' },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    const fields = response.body.errors.map((issue: { field: string }) => issue.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'assetCode',
        'assetName',
        'assetType',
        'purchaseDate',
        'location.dataCenter',
      ]),
    );
  });

  it('returns 403 for a technician and 401 without a token', async () => {
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const forbidden = await request(app)
      .post('/api/assets')
      .set(auth(technician.token))
      .send(createPayload);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('You do not have permission to perform this action');

    const anonymous = await request(app).post('/api/assets').send(createPayload);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.message).toBe('Authentication required');
  });
});

describe('GET /api/assets', () => {
  beforeEach(async () => {
    await resetDatabase();
    await createAsset({
      assetCode: 'AST-001',
      assetName: 'Alpha',
      assetType: 'SERVER',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      location: { rack: 'A', dataCenter: 'DC-1' },
      network: { hostname: 'alpha', ipAddress: '10.0.0.1', connectionStatus: 'ONLINE' },
    });
    await createAsset({
      assetCode: 'AST-002',
      assetName: 'Beta',
      assetType: 'SWITCH',
      status: 'MAINTENANCE',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      location: { rack: 'B', dataCenter: 'DC-1' },
    });
    await createAsset({
      assetCode: 'AST-003',
      assetName: 'Gamma',
      assetType: 'SERVER',
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      location: { rack: 'A', dataCenter: 'DC-2' },
    });
    // The inactive location must not satisfy the rack filter.
    await prisma.assetLocation.create({
      data: {
        assetId: (await prisma.asset.findUniqueOrThrow({ where: { assetCode: 'AST-003' } })).id,
        dataCenter: 'DC-2',
        rack: 'Z',
        isCurrent: false,
        movedAt: new Date('2025-12-01T00:00:00.000Z'),
      },
    });
  });

  it('returns every asset newest-first with pagination metadata', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const response = await request(app).get('/api/assets').set(auth(tech.token));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Assets retrieved successfully');
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    });
    expect(
      response.body.data.items.map((item: { assetCode: string }) => item.assetCode),
    ).toEqual(['AST-003', 'AST-002', 'AST-001']);

    const alpha = response.body.data.items.find(
      (item: { assetCode: string }) => item.assetCode === 'AST-001',
    );
    expect(alpha).toMatchObject({
      location: { rack: 'A', isCurrent: true },
      network: { connectionStatus: 'ONLINE', hostname: 'alpha', ipAddress: '10.0.0.1' },
    });
  });

  it('sorts by a whitelisted column in both directions', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const ascending = await request(app)
      .get('/api/assets?sortBy=assetName&order=asc')
      .set(auth(tech.token));
    expect(
      ascending.body.data.items.map((item: { assetName: string }) => item.assetName),
    ).toEqual(['Alpha', 'Beta', 'Gamma']);

    const descending = await request(app)
      .get('/api/assets?sortBy=assetName&order=desc')
      .set(auth(tech.token));
    expect(
      descending.body.data.items.map((item: { assetName: string }) => item.assetName),
    ).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('filters by case-insensitive search, type, status, and active rack', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const search = await request(app)
      .get('/api/assets?search=ALP')
      .set(auth(tech.token));
    expect(search.body.data.pagination.total).toBe(1);
    expect(search.body.data.items[0].assetCode).toBe('AST-001');

    const type = await request(app)
      .get('/api/assets?type=SERVER')
      .set(auth(tech.token));
    expect(type.body.data.pagination.total).toBe(2);

    const status = await request(app)
      .get('/api/assets?status=MAINTENANCE')
      .set(auth(tech.token));
    expect(status.body.data.items.map((item: { assetCode: string }) => item.assetCode)).toEqual([
      'AST-002',
    ]);

    const rack = await request(app).get('/api/assets?rack=a').set(auth(tech.token));
    expect(rack.body.data.pagination.total).toBe(2);

    const staleRack = await request(app).get('/api/assets?rack=Z').set(auth(tech.token));
    expect(staleRack.body.data.pagination.total).toBe(0);
  });

  it('paginates with limit and page', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const response = await request(app)
      .get('/api/assets?limit=2&page=2')
      .set(auth(tech.token));

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].assetCode).toBe('AST-001');
    expect(response.body.data.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('returns 400 for out-of-range pagination and unknown sort values', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    for (const query of ['limit=101', 'page=0', 'sortBy=password']) {
      const response = await request(app).get(`/api/assets?${query}`).set(auth(tech.token));
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    }
  });
});

describe('GET /api/assets/statistics', () => {
  beforeEach(resetDatabase);

  it('counts status, type, expiring warranties, and assets added this month', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const today = new Date();
    const inTenDays = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);

    await createAsset({ assetCode: 'S-1', assetType: 'SERVER', status: 'ACTIVE', warrantyEnd: inTenDays });
    await createAsset({ assetCode: 'S-2', assetType: 'SERVER', status: 'MAINTENANCE', warrantyEnd: tenDaysAgo });
    await createAsset({ assetCode: 'W-1', assetType: 'SWITCH', status: 'ACTIVE' });

    const response = await request(app)
      .get('/api/assets/statistics')
      .set(auth(tech.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      total: 3,
      byStatus: { ACTIVE: 2, MAINTENANCE: 1, INACTIVE: 0 },
      byType: {
        SERVER: 2,
        SWITCH: 1,
        ROUTER: 0,
        STORAGE: 0,
        FIREWALL: 0,
        RACK: 0,
        OTHER: 0,
      },
      warrantyExpiringSoon: 1,
      addedThisMonth: 3,
    });
  });
});

describe('GET /api/assets/:id', () => {
  beforeEach(resetDatabase);

  it('returns relations, the current location, and the latest active prediction', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const asset = await createAsset({
      assetCode: 'SRV-010',
      assetName: 'App Server',
      location: { rack: 'C', isCurrent: false, movedAt: new Date('2026-05-01T00:00:00.000Z') },
      network: { hostname: 'app', connectionStatus: 'ONLINE' },
    });
    const current = await prisma.assetLocation.create({
      data: {
        assetId: asset.id,
        dataCenter: 'DC-2',
        rack: 'D',
        isCurrent: true,
        movedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    });
    await createMaintenance({ assetId: asset.id });
    await createPrediction({ assetId: asset.id, riskScore: 42.5, riskLevel: 'MEDIUM', isActive: false });
    await createPrediction({
      assetId: asset.id,
      riskScore: 63.75,
      riskLevel: 'HIGH',
      confidence: 90,
      isActive: true,
      predictedFailureDays: 33,
    });

    const response = await request(app).get(`/api/assets/${asset.id}`).set(auth(tech.token));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Asset retrieved successfully');
    expect(response.body.data).toMatchObject({
      id: asset.id,
      maintenanceCount: 1,
      location: { id: current.id, rack: 'D', isCurrent: true },
      network: { hostname: 'app', connectionStatus: 'ONLINE' },
      latestPrediction: {
        riskScore: 63.75,
        riskLevel: 'HIGH',
        confidence: 90,
        predictedFailureDays: 33,
        isActive: true,
      },
    });
    expect(response.body.data.locationHistory.map((row: { isCurrent: boolean }) => row.isCurrent)).toEqual([
      true,
      false,
    ]);
  });

  it('returns 404 for a missing asset and 400 for a non-numeric id', async () => {
    const tech = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const missing = await request(app).get('/api/assets/999999').set(auth(tech.token));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, message: 'Asset not found' });

    const invalid = await request(app).get('/api/assets/not-a-number').set(auth(tech.token));
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe('Validation failed');
  });
});

describe('PUT /api/assets/:id', () => {
  beforeEach(resetDatabase);

  it('updates scalar fields', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-020', assetName: 'Old name' });

    const response = await request(app)
      .put(`/api/assets/${asset.id}`)
      .set(auth(admin.token))
      .send({ assetName: 'New name', status: 'MAINTENANCE', description: 'Updated' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Asset updated successfully');
    expect(response.body.data).toMatchObject({
      assetName: 'New name',
      status: 'MAINTENANCE',
      description: 'Updated',
      assetCode: 'SRV-020',
    });
  });

  it('moves the asset by deactivating the old location and adding a current one', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({
      assetCode: 'SRV-021',
      location: { rack: 'A', dataCenter: 'DC-1', movedAt: new Date('2026-01-01T00:00:00.000Z') },
    });

    const response = await request(app)
      .put(`/api/assets/${asset.id}`)
      .set(auth(admin.token))
      .send({ location: { dataCenter: 'DC-3', rack: 'E', rackSlot: 'U02' } });

    expect(response.status).toBe(200);
    expect(response.body.data.location).toMatchObject({
      dataCenter: 'DC-3',
      rack: 'E',
      isCurrent: true,
    });
    expect(response.body.data.locationHistory).toHaveLength(2);
    expect(response.body.data.locationHistory.map((row: { rack: string }) => row.rack)).toEqual([
      'E',
      'A',
    ]);

    const locations = await prisma.assetLocation.findMany({
      where: { assetId: asset.id },
      orderBy: { id: 'asc' },
    });
    expect(locations.map((row) => row.isCurrent)).toEqual([false, true]);
  });

  it('upserts network information without clearing omitted fields', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({
      assetCode: 'SRV-022',
      network: { hostname: 'old-host', ipAddress: '10.0.0.9', connectionStatus: 'ONLINE' },
    });

    const response = await request(app)
      .put(`/api/assets/${asset.id}`)
      .set(auth(admin.token))
      .send({ network: { hostname: 'new-host' } });

    expect(response.status).toBe(200);
    expect(response.body.data.network).toMatchObject({
      hostname: 'new-host',
      ipAddress: '10.0.0.9',
      connectionStatus: 'ONLINE',
    });
    expect(await prisma.networkInformation.count({ where: { assetId: asset.id } })).toBe(1);
  });

  it('returns 409 when renaming to an existing asset code', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await createAsset({ assetCode: 'SRV-030' });
    const asset = await createAsset({ assetCode: 'SRV-031' });

    const response = await request(app)
      .put(`/api/assets/${asset.id}`)
      .set(auth(admin.token))
      .send({ assetCode: 'SRV-030' });

    expect(response.status).toBe(409);
    expect(response.body.errors[0].field).toBe('assetCode');
  });

  it('returns 404, 400, and 403 for missing ids, invalid bodies, and technicians', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const asset = await createAsset({ assetCode: 'SRV-032' });

    const missing = await request(app)
      .put('/api/assets/999999')
      .set(auth(admin.token))
      .send({ assetName: 'Nope' });
    expect(missing.status).toBe(404);

    const invalidId = await request(app)
      .put('/api/assets/abc')
      .set(auth(admin.token))
      .send({ assetName: 'Nope' });
    expect(invalidId.status).toBe(400);

    const invalidBody = await request(app)
      .put(`/api/assets/${asset.id}`)
      .set(auth(admin.token))
      .send({ assetName: '' });
    expect(invalidBody.status).toBe(400);

    const forbidden = await request(app)
      .put(`/api/assets/${asset.id}`)
      .set(auth(technician.token))
      .send({ assetName: 'Nope' });
    expect(forbidden.status).toBe(403);
  });
});

describe('DELETE /api/assets/:id', () => {
  beforeEach(resetDatabase);

  it('deletes an asset together with its location and network rows', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({
      assetCode: 'SRV-040',
      location: { rack: 'A' },
      network: { hostname: 'deletable' },
    });

    const response = await request(app)
      .delete(`/api/assets/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Asset deleted successfully',
      data: null,
    });
    expect(await prisma.asset.count()).toBe(0);
    expect(await prisma.assetLocation.count()).toBe(0);
    expect(await prisma.networkInformation.count()).toBe(0);
  });

  it('returns 409 when maintenance history exists', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-041' });
    await createMaintenance({ assetId: asset.id });

    const response = await request(app)
      .delete(`/api/assets/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Asset has maintenance or prediction history and cannot be deleted',
    );
    expect(await prisma.asset.count()).toBe(1);
  });

  it('returns 409 when prediction history exists', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-042' });
    await createPrediction({ assetId: asset.id });

    const response = await request(app)
      .delete(`/api/assets/${asset.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(409);
    expect(await prisma.asset.count()).toBe(1);
  });

  it('returns 404 for a missing asset and 403 for a technician', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const asset = await createAsset({ assetCode: 'SRV-043' });

    const missing = await request(app)
      .delete('/api/assets/999999')
      .set(auth(admin.token));
    expect(missing.status).toBe(404);

    const forbidden = await request(app)
      .delete(`/api/assets/${asset.id}`)
      .set(auth(technician.token));
    expect(forbidden.status).toBe(403);
  });
});
