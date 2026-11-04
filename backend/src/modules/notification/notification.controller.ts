import type { RequestHandler } from 'express';
import { AppError, sendSuccess } from '../../utils/response.js';
import { idParamSchema } from '../../utils/validation.js';
import {
  deleteDeviceTokenSchema,
  deviceTokenSchema,
  listNotificationQuerySchema,
} from './notification.schema.js';
import {
  deleteDeviceTokens,
  deleteNotification,
  deleteReadNotifications,
  getNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerDeviceToken,
} from './notification.service.js';

function requireUser(req: { user?: { id: number } }): number {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  return req.user.id;
}

export const list: RequestHandler = async (req, res) => {
  const query = listNotificationQuerySchema.parse(req.query);
  const result = await listNotifications(requireUser(req), query);
  sendSuccess(res, result, 'Notifications retrieved successfully');
};

export const unreadCount: RequestHandler = async (req, res) => {
  const result = await getUnreadCount(requireUser(req));
  sendSuccess(res, result, 'Unread notification count retrieved successfully');
};

export const getById: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const row = await getNotification(requireUser(req), id);
  sendSuccess(res, row, 'Notification retrieved successfully');
};

export const markRead: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const row = await markNotificationRead(requireUser(req), id);
  sendSuccess(res, row, 'Notification marked as read');
};

export const markAllRead: RequestHandler = async (req, res) => {
  const result = await markAllNotificationsRead(requireUser(req));
  sendSuccess(res, result, 'All notifications marked as read');
};

export const remove: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  await deleteNotification(requireUser(req), id);
  sendSuccess(res, null, 'Notification deleted successfully');
};

export const removeRead: RequestHandler = async (req, res) => {
  const result = await deleteReadNotifications(requireUser(req));
  sendSuccess(res, result, 'Read notifications deleted successfully');
};

export const registerDevice: RequestHandler = async (req, res) => {
  const input = deviceTokenSchema.parse(req.body ?? {});
  const row = await registerDeviceToken(requireUser(req), input);
  sendSuccess(res, row, 'Device token registered successfully');
};

export const removeDevice: RequestHandler = async (req, res) => {
  const input = deleteDeviceTokenSchema.parse(req.body ?? {});
  const result = await deleteDeviceTokens(requireUser(req), input.token);
  sendSuccess(res, result, 'Device token removed successfully');
};
