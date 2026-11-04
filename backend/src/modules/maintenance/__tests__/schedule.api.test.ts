import request from 'supertest';
import { createApp } from '../../../app.js';
import {
  disconnectDatabase,
  resetDatabase,
} from '../../../../test/support/database.js';
import {
  auth,
  createAsset,
  createMaintenance,
  createUser,
} from '../../../../test/support/fixtures.js';

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

afterAll(disconnectDatabase);

/** Date-only ISO string for today (UTC) plus `offset` days. */
function isoDay(offset: number): string {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(today.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

function dateAt(offset: number): Date {
  return new Date(`${isoDay(offset)}T00:00:00.000Z`);
}

/** One asset per offset keeps every row distinguishable in the response. */
async function seedSchedules(offsets: number[]) {
  const asset = await createAsset({ assetCode: 'SRV-100' });
  const created: Array<{ offset: number; id: number }> = [];
  for (const [index, offset] of offsets.entries()) {
    const row = await createMaintenance({
      assetId: asset.id,
      maintenanceType: index % 2 === 0 ? 'ROUTINE' : 'INSPECTION',
      maintenanceDate: dateAt(-30),
      result: `Hasil ${offset}`,
      nextSchedule: dateAt(offset),
    });
    created.push({ offset, id: row.id });
  }
  return { asset, created };
}

describe('GET /api/maintenance/schedule', () => {
  beforeEach(resetDatabase);

  it('buckets boundaries for window=30, overdue first, and reports board counts', async () => {
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const { asset } = await seedSchedules([-1, 0, 7, 8, 30, 31]);
    await createMaintenance({
      assetId: asset.id,
      maintenanceDate: dateAt(-10),
      nextSchedule: null,
    });

    const response = await request(app)
      .get('/api/maintenance/schedule?window=30')
      .set(auth(technician.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      window: 30,
      includeOverdue: true,
      today: isoDay(0),
      counts: { overdue: 1, dueSoon: 2, upcoming: 2, total: 5 },
    });

    const items = response.body.data.items as Array<{
      nextSchedule: string;
      daysUntil: number;
      state: string;
      lastResult: string;
      asset: { assetCode: string; assetName: string; assetType: string; status: string };
    }>;
    expect(items.map((item) => [item.nextSchedule, item.daysUntil, item.state])).toEqual([
      [isoDay(-1), -1, 'OVERDUE'],
      [isoDay(0), 0, 'DUE_SOON'],
      [isoDay(7), 7, 'DUE_SOON'],
      [isoDay(8), 8, 'UPCOMING'],
      [isoDay(30), 30, 'UPCOMING'],
    ]);
    expect(items[0]?.lastResult).toBe('Hasil -1');
    expect(items[0]?.asset).toEqual({
      id: asset.id,
      assetCode: 'SRV-100',
      assetName: 'Asset SRV-100',
      assetType: 'SERVER',
      status: 'ACTIVE',
    });
  });

  it('limits the list to window=7 while keeping the board counts', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await seedSchedules([-2, 0, 7, 8, 30]);

    const response = await request(app)
      .get('/api/maintenance/schedule?window=7')
      .set(auth(admin.token));

    expect(response.status).toBe(200);
    expect(
      response.body.data.items.map((item: { daysUntil: number }) => item.daysUntil),
    ).toEqual([-2, 0, 7]);
    expect(response.body.data.counts).toEqual({
      overdue: 1,
      dueSoon: 2,
      upcoming: 2,
      total: 5,
    });
  });

  it('honours includeOverdue=false for both windows', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await seedSchedules([-3, 0, 7, 30]);

    const seven = await request(app)
      .get('/api/maintenance/schedule?window=7&includeOverdue=false')
      .set(auth(admin.token));
    expect(
      seven.body.data.items.map((item: { daysUntil: number }) => item.daysUntil),
    ).toEqual([0, 7]);

    const thirty = await request(app)
      .get('/api/maintenance/schedule?window=30&includeOverdue=false')
      .set(auth(admin.token));
    expect(
      thirty.body.data.items.map((item: { daysUntil: number }) => item.daysUntil),
    ).toEqual([0, 7, 30]);
  });

  it('returns 400 for an unsupported window and 401 without a token', async () => {
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });

    const invalid = await request(app)
      .get('/api/maintenance/schedule?window=14')
      .set(auth(technician.token));
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe('Validation failed');

    const notANumber = await request(app)
      .get('/api/maintenance/schedule?window=abc')
      .set(auth(technician.token));
    expect(notANumber.status).toBe(400);

    const anonymous = await request(app).get('/api/maintenance/schedule');
    expect(anonymous.status).toBe(401);
  });
});
