import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, buildPagination } from '../../utils/response.js';
import type { ListNotificationQuery } from './notification.schema.js';

// Every read and write is scoped to the authenticated user. A row belonging
// to another user is reported as 404 so its existence is not leaked.

const notificationInclude = {
  asset: { select: { id: true, assetCode: true, assetName: true } },
} as const;

type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

function serializeNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.isRead,
    readAt: row.readAt,
    createdAt: row.createdAt,
    assetId: row.assetId,
    predictionId: row.predictionId,
    maintenanceId: row.maintenanceId,
    dedupeKey: row.dedupeKey,
    asset: row.asset,
  };
}

export async function listNotifications(
  userId: number,
  query: ListNotificationQuery,
) {
  const where: Prisma.NotificationWhereInput = { userId };
  if (query.isRead !== undefined) {
    where.isRead = query.isRead;
  }
  if (query.type) {
    where.type = query.type;
  }

  const [total, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(serializeNotification),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

export async function getNotification(userId: number, id: number) {
  const row = await prisma.notification.findFirst({
    where: { id, userId },
    include: notificationInclude,
  });
  if (!row) {
    throw new AppError(404, 'Notification not found');
  }
  return serializeNotification(row);
}

export async function getUnreadCount(userId: number) {
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount };
}

export async function markNotificationRead(userId: number, id: number) {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
    select: { id: true, readAt: true },
  });
  if (!existing) {
    throw new AppError(404, 'Notification not found');
  }

  const row = await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: existing.readAt ?? new Date() },
    include: notificationInclude,
  });
  return serializeNotification(row);
}

export async function markAllNotificationsRead(userId: number) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
}

export async function deleteNotification(userId: number, id: number): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Notification not found');
  }
  await prisma.notification.delete({ where: { id } });
}

export async function deleteReadNotifications(userId: number) {
  const result = await prisma.notification.deleteMany({
    where: { userId, isRead: true },
  });
  return { deleted: result.count };
}

export interface HighRiskAlertInput {
  predictionId: number;
  assetId: number;
  assetCode: string;
  assetName: string;
  riskScore: number;
  recommendation: string;
}

/**
 * Creates one AI_ALERT per active user for a HIGH prediction. Runs inside the
 * caller's transaction; the existing-row check makes a retry idempotent for
 * the same prediction id.
 */
export async function createHighRiskAlerts(
  tx: Prisma.TransactionClient,
  input: HighRiskAlertInput,
): Promise<number> {
  const users = await tx.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (users.length === 0) {
    return 0;
  }

  const existing = await tx.notification.findMany({
    where: {
      predictionId: input.predictionId,
      userId: { in: users.map((user) => user.id) },
    },
    select: { userId: true },
  });
  const alreadyAlerted = new Set(existing.map((row) => row.userId));
  const recipients = users.filter((user) => !alreadyAlerted.has(user.id));
  if (recipients.length === 0) {
    return 0;
  }

  const created = await tx.notification.createMany({
    data: recipients.map((user) => ({
      userId: user.id,
      assetId: input.assetId,
      predictionId: input.predictionId,
      type: 'AI_ALERT',
      title: `AI Alert: ${input.assetCode} risiko HIGH`,
      message: `Prediksi risiko ${input.riskScore}/100 (HIGH) untuk ${input.assetCode} - ${input.assetName}. ${input.recommendation}`,
    })),
  });
  return created.count;
}
