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
  createNotification,
  createUser,
} from '../../../../test/support/fixtures.js';

const app = createApp();

describe('notification endpoints (user scoped)', () => {
  let adminToken: string;
  let otherToken: string;
  let adminId: number;
  let otherId: number;
  let unreadId: number;
  let readId: number;
  let otherNotificationId: number;

  beforeEach(async () => {
    await resetDatabase();
    const admin = await createUser({ username: 'admin', role: 'ADMIN' });
    const other = await createUser({ username: 'other' });
    adminToken = admin.token;
    otherToken = other.token;
    adminId = admin.id;
    otherId = other.id;
    const asset = await createAsset({ assetCode: 'SRV-001', assetName: 'WEB Server 01' });

    const unread = await createNotification({
      userId: admin.id,
      assetId: asset.id,
      type: 'AI_ALERT',
      title: 'AI Alert: SRV-001 risiko HIGH',
      message: 'Prediksi risiko 83.5/100 (HIGH)',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    });
    unreadId = unread.id;
    const read = await createNotification({
      userId: admin.id,
      type: 'INFO',
      title: 'Maintenance reminder',
      isRead: true,
      readAt: new Date('2026-10-02T09:00:00.000Z'),
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
    });
    readId = read.id;
    const foreign = await createNotification({
      userId: other.id,
      type: 'SYSTEM',
      title: 'Other user only',
      createdAt: new Date('2026-10-03T10:00:00.000Z'),
    });
    otherNotificationId = foreign.id;
  });
  afterAll(disconnectDatabase);

  it('GET /api/notifications lists only the caller rows, newest-first', async () => {
    const response = await request(app)
      .get('/api/notifications')
      .set(auth(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Notifications retrieved successfully');
    expect(response.body.data.items.map((row: { id: number }) => row.id)).toEqual([
      readId,
      unreadId,
    ]);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    const rows = response.body.data.items as Array<Record<string, unknown>>;
    expect(rows.every((row) => row.userId === undefined)).toBe(true);
    expect(rows[1]).toMatchObject({
      assetId: expect.any(Number),
      asset: { assetCode: 'SRV-001', assetName: 'WEB Server 01' },
    });
    expect(rows[0]).toMatchObject({ assetId: null, asset: null });
  });

  it('filters by isRead and type, paginates, and rejects invalid flags', async () => {
    const unread = await request(app)
      .get('/api/notifications?isRead=false')
      .set(auth(adminToken));
    expect(unread.body.data.pagination.total).toBe(1);
    expect(unread.body.data.items[0].id).toBe(unreadId);

    const ai = await request(app)
      .get('/api/notifications?type=AI_ALERT')
      .set(auth(adminToken));
    expect(ai.body.data.pagination.total).toBe(1);

    const page = await request(app)
      .get('/api/notifications?limit=1&page=2')
      .set(auth(adminToken));
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.pagination.totalPages).toBe(2);

    for (const query of ['isRead=maybe', 'type=ALERT']) {
      const invalid = await request(app)
        .get(`/api/notifications?${query}`)
        .set(auth(adminToken));
      expect(invalid.status).toBe(400);
      expect(invalid.body.message).toBe('Validation failed');
    }

    const anonymous = await request(app).get('/api/notifications');
    expect(anonymous.status).toBe(401);
  });

  it('GET /api/notifications/unread-count counts only the caller unread rows', async () => {
    const admin = await request(app)
      .get('/api/notifications/unread-count')
      .set(auth(adminToken));
    expect(admin.status).toBe(200);
    expect(admin.body.data).toEqual({ unreadCount: 1 });

    const other = await request(app)
      .get('/api/notifications/unread-count')
      .set(auth(otherToken));
    expect(other.body.data).toEqual({ unreadCount: 1 });
  });

  it('GET /api/notifications/:id hides other users rows behind 404', async () => {
    const own = await request(app)
      .get(`/api/notifications/${unreadId}`)
      .set(auth(adminToken));
    expect(own.status).toBe(200);
    expect(own.body.data.id).toBe(unreadId);

    const foreign = await request(app)
      .get(`/api/notifications/${otherNotificationId}`)
      .set(auth(adminToken));
    expect(foreign.status).toBe(404);
    expect(foreign.body.message).toBe('Notification not found');

    const missing = await request(app)
      .get('/api/notifications/999999')
      .set(auth(adminToken));
    expect(missing.status).toBe(404);

    const invalid = await request(app)
      .get('/api/notifications/abc')
      .set(auth(adminToken));
    expect(invalid.status).toBe(400);
  });

  it('PUT /api/notifications/:id/read sets readAt once and keeps it on repeat calls', async () => {
    const first = await request(app)
      .put(`/api/notifications/${unreadId}/read`)
      .set(auth(adminToken));
    expect(first.status).toBe(200);
    expect(first.body.message).toBe('Notification marked as read');
    expect(first.body.data.isRead).toBe(true);
    expect(first.body.data.readAt).toEqual(expect.any(String));
    const firstReadAt = first.body.data.readAt;

    const second = await request(app)
      .put(`/api/notifications/${unreadId}/read`)
      .set(auth(adminToken));
    expect(second.body.data.readAt).toBe(firstReadAt);

    // A row read days earlier keeps its original timestamp, so the assertion
    // above cannot pass by two requests sharing one millisecond.
    const previouslyRead = await request(app)
      .put(`/api/notifications/${readId}/read`)
      .set(auth(adminToken));
    expect(previouslyRead.body.data.readAt).toBe('2026-10-02T09:00:00.000Z');

    const foreign = await request(app)
      .put(`/api/notifications/${otherNotificationId}/read`)
      .set(auth(adminToken));
    expect(foreign.status).toBe(404);
  });

  it('PUT /api/notifications/read-all updates only unread caller rows', async () => {
    const response = await request(app)
      .put('/api/notifications/read-all')
      .set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ updated: 1 });

    const repeated = await request(app)
      .put('/api/notifications/read-all')
      .set(auth(adminToken));
    expect(repeated.body.data).toEqual({ updated: 0 });

    const adminRows = await prisma.notification.findMany({
      where: { userId: adminId },
      orderBy: { id: 'asc' },
    });
    expect(adminRows.every((row) => row.isRead && row.readAt !== null)).toBe(true);

    const otherRow = await prisma.notification.findUniqueOrThrow({
      where: { id: otherNotificationId },
    });
    expect(otherRow.isRead).toBe(false);
  });

  it('DELETE /api/notifications/:id removes only the caller row', async () => {
    const response = await request(app)
      .delete(`/api/notifications/${unreadId}`)
      .set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Notification deleted successfully',
      data: null,
    });
    expect(await prisma.notification.count({ where: { id: unreadId } })).toBe(0);

    const foreign = await request(app)
      .delete(`/api/notifications/${otherNotificationId}`)
      .set(auth(adminToken));
    expect(foreign.status).toBe(404);

    const missing = await request(app)
      .delete('/api/notifications/999999')
      .set(auth(adminToken));
    expect(missing.status).toBe(404);
  });

  it('DELETE /api/notifications/read deletes only read caller rows', async () => {
    const response = await request(app)
      .delete('/api/notifications/read')
      .set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ deleted: 1 });

    const remaining = await prisma.notification.findMany({
      where: { userId: adminId },
    });
    expect(remaining.map((row) => row.id)).toEqual([unreadId]);

    const repeated = await request(app)
      .delete('/api/notifications/read')
      .set(auth(adminToken));
    expect(repeated.body.data).toEqual({ deleted: 0 });

    expect(
      await prisma.notification.count({ where: { userId: otherId } }),
    ).toBe(1);
  });
});
