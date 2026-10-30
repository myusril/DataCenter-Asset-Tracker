import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  getById,
  list,
  markAllRead,
  markRead,
  remove,
  removeRead,
  unreadCount,
} from './notification.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', list);
// Literal paths must be registered before '/:id' so they are not parsed as ids.
notificationRoutes.get('/unread-count', unreadCount);
notificationRoutes.put('/read-all', markAllRead);
notificationRoutes.delete('/read', removeRead);
notificationRoutes.get('/:id', getById);
notificationRoutes.put('/:id/read', markRead);
notificationRoutes.delete('/:id', remove);
