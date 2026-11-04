import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  byAsset,
  create,
  getById,
  list,
  remove,
  runReminders,
  schedule,
  statistics,
  update,
} from './maintenance.controller.js';

export const maintenanceRoutes = Router();

maintenanceRoutes.use(authenticate);

maintenanceRoutes.get('/', list);
// Static and nested routes must be registered before '/:id'.
maintenanceRoutes.get('/statistics', statistics);
maintenanceRoutes.get('/schedule', schedule);
maintenanceRoutes.post('/reminders', requireRole('ADMIN'), runReminders);
maintenanceRoutes.get('/asset/:assetId', byAsset);
maintenanceRoutes.get('/:id', getById);
maintenanceRoutes.post('/', requireRole('ADMIN'), create);
maintenanceRoutes.put('/:id', requireRole('ADMIN'), update);
maintenanceRoutes.delete('/:id', requireRole('ADMIN'), remove);
