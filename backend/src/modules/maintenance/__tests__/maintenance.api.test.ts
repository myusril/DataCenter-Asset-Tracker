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
  createUser,
} from '../../../../test/support/fixtures.js';

const app = createApp();

afterAll(disconnectDatabase);

describe('POST /api/maintenance', () => {
  beforeEach(resetDatabase);

  it('creates a record, defaults the technician to the caller, and moves the asset to MAINTENANCE', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-001', status: 'ACTIVE' });

    const response = await request(app)
      .post('/api/maintenance')
      .set(auth(admin.token))
      .send({
        assetId: asset.id,
        maintenanceType: 'REPAIR',
        maintenanceDate: '2026-10-05',
        description: 'Ganti RAM',
        result: 'In progress',
        cost: 850000,
        nextSchedule: '2027-03-25',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Maintenance record created successfully',
      data: {
        assetId: asset.id,
        technicianId: admin.id,
        maintenanceType: 'REPAIR',
        maintenanceDate: '2026-10-05',
        result: 'In progress',
        cost: 850000,
        nextSchedule: '2027-03-25',
        technician: { id: admin.id, username: 'admin' },
        asset: { id: asset.id, assetCode: 'SRV-001' },
      },
    });
    expect(typeof response.body.data.cost).toBe('number');

    const stored = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.status).toBe('MAINTENANCE');
  });

  it('honours an explicit technician id', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const asset = await createAsset({ assetCode: 'SRV-002' });

    const response = await request(app)
      .post('/api/maintenance')
      .set(auth(admin.token))
      .send({
        assetId: asset.id,
        technicianId: technician.id,
        maintenanceType: 'ROUTINE',
        maintenanceDate: '2026-10-06',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.technician).toEqual({
      id: technician.id,
      username: 'tech',
      fullName: 'Fixture tech',
    });
    const stored = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.status).toBe('ACTIVE');
  });

  it('lets a "Resolved" result win over the type-driven status rule', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-003', status: 'ACTIVE' });

    const response = await request(app)
      .post('/api/maintenance')
      .set(auth(admin.token))
      .send({
        assetId: asset.id,
        maintenanceType: 'REPLACEMENT',
        maintenanceDate: '2026-10-07',
        result: '  RESOLVED - disk replaced',
      });

    expect(response.status).toBe(201);
    const stored = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.status).toBe('ACTIVE');
  });

  it('returns 404 for unknown assets and technicians', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-004' });

    const missingAsset = await request(app)
      .post('/api/maintenance')
      .set(auth(admin.token))
      .send({ assetId: 999999, maintenanceType: 'ROUTINE', maintenanceDate: '2026-10-08' });
    expect(missingAsset.status).toBe(404);
    expect(missingAsset.body.message).toBe('Asset not found');

    const missingTechnician = await request(app)
      .post('/api/maintenance')
      .set(auth(admin.token))
      .send({
        assetId: asset.id,
        technicianId: 999999,
        maintenanceType: 'ROUTINE',
        maintenanceDate: '2026-10-08',
      });
    expect(missingTechnician.status).toBe(404);
    expect(missingTechnician.body.message).toBe('Technician not found');
  });

  it('returns 400 for invalid input, 403 for a technician, and 401 anonymously', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const asset = await createAsset({ assetCode: 'SRV-005' });

    const invalid = await request(app)
      .post('/api/maintenance')
      .set(auth(admin.token))
      .send({ maintenanceType: 'BROKEN', cost: -1, nextSchedule: 'tomorrow' });
    expect(invalid.status).toBe(400);
    const fields = invalid.body.errors.map((issue: { field: string }) => issue.field);
    expect(fields).toEqual(
      expect.arrayContaining(['assetId', 'maintenanceType', 'maintenanceDate', 'cost', 'nextSchedule']),
    );

    const forbidden = await request(app)
      .post('/api/maintenance')
      .set(auth(technician.token))
      .send({ assetId: asset.id, maintenanceType: 'ROUTINE', maintenanceDate: '2026-10-08' });
    expect(forbidden.status).toBe(403);

    const anonymous = await request(app)
      .post('/api/maintenance')
      .send({ assetId: asset.id, maintenanceType: 'ROUTINE', maintenanceDate: '2026-10-08' });
    expect(anonymous.status).toBe(401);
  });
});

describe('GET /api/maintenance', () => {
  let technicianToken: string;
  let firstAssetId: number;
  let otherTechnicianId: number;

  beforeEach(async () => {
    await resetDatabase();
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    technicianToken = technician.token;
    const other = await createUser({ username: 'other' });
    otherTechnicianId = other.id;
    const first = await createAsset({ assetCode: 'SRV-010' });
    const second = await createAsset({ assetCode: 'SRV-011' });
    firstAssetId = first.id;

    await createMaintenance({
      assetId: first.id,
      technicianId: admin.id,
      maintenanceType: 'ROUTINE',
      maintenanceDate: new Date('2026-10-01T00:00:00.000Z'),
    });
    await createMaintenance({
      assetId: first.id,
      technicianId: admin.id,
      maintenanceType: 'REPAIR',
      maintenanceDate: new Date('2026-10-05T00:00:00.000Z'),
    });
    await createMaintenance({
      assetId: second.id,
      technicianId: other.id,
      maintenanceType: 'INSPECTION',
      maintenanceDate: new Date('2026-09-01T00:00:00.000Z'),
    });
  });

  it('lists newest-first with pagination and joined asset/technician', async () => {
    const response = await request(app)
      .get('/api/maintenance')
      .set(auth(technicianToken));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Maintenance records retrieved successfully');
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    });
    expect(
      response.body.data.items.map((item: { maintenanceDate: string }) => item.maintenanceDate),
    ).toEqual(['2026-10-05', '2026-10-01', '2026-09-01']);
    expect(response.body.data.items[2].asset).toMatchObject({
      id: expect.any(Number),
      assetCode: 'SRV-011',
    });
    expect(response.body.data.items[0].technician.username).toBe('admin');
  });

  it('filters by type, asset, technician, and inclusive date windows', async () => {
    const byType = await request(app)
      .get('/api/maintenance?type=REPAIR')
      .set(auth(technicianToken));
    expect(byType.body.data.pagination.total).toBe(1);

    const byAsset = await request(app)
      .get(`/api/maintenance?assetId=${firstAssetId}`)
      .set(auth(technicianToken));
    expect(byAsset.body.data.pagination.total).toBe(2);

    const byTechnician = await request(app)
      .get(`/api/maintenance?technicianId=${otherTechnicianId}`)
      .set(auth(technicianToken));
    expect(byTechnician.body.data.pagination.total).toBe(1);
    expect(byTechnician.body.data.items[0].maintenanceType).toBe('INSPECTION');

    const window = await request(app)
      .get('/api/maintenance?startDate=2026-10-01&endDate=2026-10-05')
      .set(auth(technicianToken));
    expect(window.body.data.pagination.total).toBe(2);

    const fromOnly = await request(app)
      .get('/api/maintenance?startDate=2026-10-02')
      .set(auth(technicianToken));
    expect(fromOnly.body.data.pagination.total).toBe(1);

    const untilOnly = await request(app)
      .get('/api/maintenance?endDate=2026-10-01')
      .set(auth(technicianToken));
    expect(untilOnly.body.data.pagination.total).toBe(2);
  });

  it('paginates and rejects invalid query values', async () => {
    const page = await request(app)
      .get('/api/maintenance?limit=2&page=2')
      .set(auth(technicianToken));
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.pagination.totalPages).toBe(2);

    const invalid = await request(app)
      .get('/api/maintenance?type=BROKEN&limit=101')
      .set(auth(technicianToken));
    expect(invalid.status).toBe(400);
  });
});

describe('GET /api/maintenance/statistics', () => {
  beforeEach(resetDatabase);

  it('aggregates totals, cost, current-month count, and upcoming schedules', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-020' });
    const now = new Date();
    const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));

    await createMaintenance({
      assetId: asset.id,
      technicianId: admin.id,
      maintenanceType: 'ROUTINE',
      maintenanceDate: startOfMonth,
      cost: 100000,
      nextSchedule: inTenDays,
    });
    await createMaintenance({
      assetId: asset.id,
      technicianId: admin.id,
      maintenanceType: 'REPAIR',
      maintenanceDate: new Date(startOfMonth.getTime() + 60 * 60 * 1000),
      cost: 250000,
      nextSchedule: yesterday,
    });
    await createMaintenance({
      assetId: asset.id,
      technicianId: admin.id,
      maintenanceType: 'UPGRADE',
      maintenanceDate: previousMonth,
      cost: 50000,
    });

    const response = await request(app)
      .get('/api/maintenance/statistics')
      .set(auth(admin.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      total: 3,
      byType: {
        ROUTINE: 1,
        REPAIR: 1,
        UPGRADE: 1,
        INSPECTION: 0,
        REPLACEMENT: 0,
      },
      totalCost: 400000,
      thisMonthCount: 2,
      upcomingSchedules: 1,
    });
  });
});

describe('GET /api/maintenance by asset and id', () => {
  beforeEach(resetDatabase);

  it('returns one asset history newest-first and 404 for a missing asset', async () => {
    const tech = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-030' });
    await createMaintenance({
      assetId: asset.id,
      maintenanceDate: new Date('2026-01-01T00:00:00.000Z'),
    });
    await createMaintenance({
      assetId: asset.id,
      maintenanceDate: new Date('2026-02-01T00:00:00.000Z'),
    });

    const response = await request(app)
      .get(`/api/maintenance/asset/${asset.id}`)
      .set(auth(tech.token));
    expect(response.status).toBe(200);
    expect(response.body.data.items.map((item: { maintenanceDate: string }) => item.maintenanceDate)).toEqual([
      '2026-02-01',
      '2026-01-01',
    ]);

    const missing = await request(app)
      .get('/api/maintenance/asset/999999')
      .set(auth(tech.token));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Asset not found');
  });

  it('returns a record by id with 404 and 400 on bad ids', async () => {
    const tech = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-031' });
    const record = await createMaintenance({
      assetId: asset.id,
      maintenanceType: 'INSPECTION',
      description: 'Disk check',
      cost: 12500,
    });

    const response = await request(app)
      .get(`/api/maintenance/${record.id}`)
      .set(auth(tech.token));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: record.id,
      maintenanceType: 'INSPECTION',
      description: 'Disk check',
      cost: 12500,
    });

    const missing = await request(app)
      .get('/api/maintenance/999999')
      .set(auth(tech.token));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Maintenance record not found');

    const invalid = await request(app)
      .get('/api/maintenance/abc')
      .set(auth(tech.token));
    expect(invalid.status).toBe(400);
  });
});

describe('PUT /api/maintenance/:id', () => {
  beforeEach(resetDatabase);

  it('updates fields, costs, dates, and the technician', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-040' });
    const record = await createMaintenance({ assetId: asset.id, technicianId: admin.id });

    const response = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(admin.token))
      .send({
        description: 'Updated description',
        cost: 99000.5,
        maintenanceDate: '2026-08-08',
        nextSchedule: '2027-01-01',
        technicianId: technician.id,
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Maintenance record updated successfully');
    expect(response.body.data).toMatchObject({
      description: 'Updated description',
      cost: 99000.5,
      maintenanceDate: '2026-08-08',
      nextSchedule: '2027-01-01',
      technicianId: technician.id,
    });
  });

  it('returns the asset to ACTIVE when the updated result starts with Resolved', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-041', status: 'MAINTENANCE' });
    const record = await createMaintenance({
      assetId: asset.id,
      maintenanceType: 'REPAIR',
      result: 'In progress',
    });

    const response = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(admin.token))
      .send({ result: 'resolved after replacement' });

    expect(response.status).toBe(200);
    const stored = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.status).toBe('ACTIVE');
  });

  it('does not revert the asset status when only the type changes', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-042', status: 'MAINTENANCE' });
    const record = await createMaintenance({
      assetId: asset.id,
      maintenanceType: 'REPAIR',
      result: 'In progress',
    });

    const response = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(admin.token))
      .send({ maintenanceType: 'ROUTINE' });

    expect(response.status).toBe(200);
    expect(response.body.data.maintenanceType).toBe('ROUTINE');
    const stored = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.status).toBe('MAINTENANCE');
  });

  it('ignores assetId in the update body', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-043' });
    const other = await createAsset({ assetCode: 'SRV-044' });
    const record = await createMaintenance({ assetId: asset.id });

    const response = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(admin.token))
      .send({ assetId: other.id, description: 'Moved?' });

    expect(response.status).toBe(200);
    expect(response.body.data.assetId).toBe(asset.id);
  });

  it('returns 404, 400, and 403 for missing records, bad input, and technicians', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-045' });
    const record = await createMaintenance({ assetId: asset.id });

    const missing = await request(app)
      .put('/api/maintenance/999999')
      .set(auth(admin.token))
      .send({ description: 'x' });
    expect(missing.status).toBe(404);

    const missingTechnician = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(admin.token))
      .send({ technicianId: 999999 });
    expect(missingTechnician.status).toBe(404);
    expect(missingTechnician.body.message).toBe('Technician not found');

    const invalid = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(admin.token))
      .send({ cost: -5, maintenanceDate: 'not-a-date' });
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .put(`/api/maintenance/${record.id}`)
      .set(auth(technician.token))
      .send({ description: 'x' });
    expect(forbidden.status).toBe(403);
  });
});

describe('DELETE /api/maintenance/:id', () => {
  beforeEach(resetDatabase);

  it('deletes the record and leaves the asset status untouched', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const asset = await createAsset({ assetCode: 'SRV-050', status: 'MAINTENANCE' });
    const record = await createMaintenance({ assetId: asset.id, maintenanceType: 'REPAIR' });

    const response = await request(app)
      .delete(`/api/maintenance/${record.id}`)
      .set(auth(admin.token));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Maintenance record deleted successfully',
      data: null,
    });
    expect(await prisma.maintenanceHistory.count()).toBe(0);
    const stored = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.status).toBe('MAINTENANCE');
  });

  it('returns 404 for a missing record and 403 for a technician', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech' });
    const asset = await createAsset({ assetCode: 'SRV-051' });
    const record = await createMaintenance({ assetId: asset.id });

    const missing = await request(app)
      .delete('/api/maintenance/999999')
      .set(auth(admin.token));
    expect(missing.status).toBe(404);

    const forbidden = await request(app)
      .delete(`/api/maintenance/${record.id}`)
      .set(auth(technician.token));
    expect(forbidden.status).toBe(403);
  });
});
