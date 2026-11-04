import request from 'supertest';
import { createApp } from '../../../app.js';
import { createMaintenanceReminders } from '../maintenance.service.js';
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
const DAY_MS = 24 * 60 * 60 * 1000;

afterAll(disconnectDatabase);

function isoDay(offset: number): string {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(today.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

function dateAt(offset: number): Date {
  return new Date(`${isoDay(offset)}T00:00:00.000Z`);
}

async function seedSchedules(offsets: number[]) {
  const asset = await createAsset({ assetCode: 'SRV-200', assetName: 'DB Server 02' });
  const rows: Array<{ offset: number; id: number }> = [];
  for (const offset of offsets) {
    const row = await createMaintenance({
      assetId: asset.id,
      maintenanceDate: dateAt(-20),
      result: `Hasil ${offset}`,
      nextSchedule: dateAt(offset),
    });
    rows.push({ offset, id: row.id });
  }
  return { asset, rows };
}

describe('POST /api/maintenance/reminders', () => {
  beforeEach(resetDatabase);

  it('creates one reminder per active user per due schedule and is idempotent', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    const inactive = await createUser({
      username: 'inactive',
      role: 'TECHNICIAN',
      isActive: false,
    });
    const { asset, rows } = await seedSchedules([-2, 5, 10]);

    const first = await request(app)
      .post('/api/maintenance/reminders')
      .set(auth(admin.token));

    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ scanned: 2, created: 4, skipped: 0 });

    const reminders = await prisma.notification.findMany({
      where: { type: 'MAINTENANCE_REMINDER' },
      orderBy: [{ userId: 'asc' }, { maintenanceId: 'asc' }],
    });
    expect(reminders).toHaveLength(4);
    expect(reminders.map((row) => row.userId)).toEqual([
      admin.id,
      admin.id,
      technician.id,
      technician.id,
    ]);
    expect(reminders.filter((row) => row.userId === inactive.id)).toHaveLength(0);

    const overdueRow = rows.find((row) => row.offset === -2);
    expect(overdueRow).toBeDefined();
    const overdue = reminders.find((row) => row.maintenanceId === overdueRow?.id);
    expect(overdue).toMatchObject({
      userId: admin.id,
      assetId: asset.id,
      type: 'MAINTENANCE_REMINDER',
      isRead: false,
      dedupeKey: `${overdueRow?.id}:${isoDay(-2)}`,
      title: 'Pengingat maintenance: SRV-200',
    });
    expect(overdue?.message).toContain('SRV-200');
    expect(overdue?.message).toContain('terlewat 2 hari');
    expect(overdue?.message).toContain('Hasil -2');

    const second = await request(app)
      .post('/api/maintenance/reminders')
      .set(auth(admin.token));
    expect(second.body.data).toEqual({ scanned: 2, created: 0, skipped: 4 });
    expect(
      await prisma.notification.count({ where: { type: 'MAINTENANCE_REMINDER' } }),
    ).toBe(4);

    const list = await request(app)
      .get('/api/notifications')
      .set(auth(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(2);
    expect(list.body.data.items[0]).toMatchObject({
      type: 'MAINTENANCE_REMINDER',
      maintenanceId: expect.any(Number),
      dedupeKey: expect.stringMatching(/^\d+:\d{4}-\d{2}-\d{2}$/),
      asset: { assetCode: 'SRV-200', assetName: 'DB Server 02' },
    });
  });

  it('creates a fresh reminder when nextSchedule changes and recreates deleted rows', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const { rows } = await seedSchedules([2]);
    const maintenanceId = rows[0]?.id as number;
    const firstKey = `${maintenanceId}:${isoDay(2)}`;

    await request(app).post('/api/maintenance/reminders').set(auth(admin.token));
    expect(await prisma.notification.count()).toBe(1);

    const updated = await request(app)
      .put(`/api/maintenance/${maintenanceId}`)
      .set(auth(admin.token))
      .send({ nextSchedule: isoDay(4) });
    expect(updated.status).toBe(200);
    expect(updated.body.data.nextSchedule).toBe(isoDay(4));

    const second = await request(app)
      .post('/api/maintenance/reminders')
      .set(auth(admin.token));
    expect(second.body.data).toEqual({ scanned: 1, created: 1, skipped: 0 });

    const keys = (
      await prisma.notification.findMany({ select: { dedupeKey: true } })
    ).map((row) => row.dedupeKey);
    expect(keys).toHaveLength(2);
    expect(keys).toContain(firstKey);
    expect(keys).toContain(`${maintenanceId}:${isoDay(4)}`);

    const currentKey = `${maintenanceId}:${isoDay(4)}`;
    const [currentReminder] = await prisma.notification.findMany({
      where: { dedupeKey: currentKey },
      select: { id: true },
    });
    await request(app)
      .delete(`/api/notifications/${currentReminder?.id}`)
      .set(auth(admin.token));

    const third = await request(app)
      .post('/api/maintenance/reminders')
      .set(auth(admin.token));
    expect(third.body.data).toEqual({ scanned: 1, created: 1, skipped: 0 });
    expect(
      await prisma.notification.count({ where: { dedupeKey: currentKey } }),
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { dedupeKey: firstKey } }),
    ).toBe(1);
  });

  it('returns 403 for a technician and 401 anonymously', async () => {
    const technician = await createUser({ username: 'tech', role: 'TECHNICIAN' });
    await seedSchedules([-1]);

    const forbidden = await request(app)
      .post('/api/maintenance/reminders')
      .set(auth(technician.token));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.success).toBe(false);

    const anonymous = await request(app).post('/api/maintenance/reminders');
    expect(anonymous.status).toBe(401);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('scans nothing when no schedule is due and never fans out to inactive users', async () => {
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    await seedSchedules([8, 30]);

    const notDue = await request(app)
      .post('/api/maintenance/reminders')
      .set(auth(admin.token));
    expect(notDue.body.data).toEqual({ scanned: 0, created: 0, skipped: 0 });

    // Every account inactive: no one can authenticate, so the service is the
    // only way to reach this state.
    await prisma.user.updateMany({ data: { isActive: false } });
    await createMaintenance({
      assetId: (await prisma.asset.findFirstOrThrow()).id,
      maintenanceDate: dateAt(-1),
      nextSchedule: dateAt(0),
    });

    const result = await createMaintenanceReminders();
    expect(result).toEqual({ scanned: 1, created: 0, skipped: 0 });
    expect(await prisma.notification.count()).toBe(0);
  });
});
