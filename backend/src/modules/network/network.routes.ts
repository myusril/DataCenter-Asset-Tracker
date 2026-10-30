import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  byAsset,
  check,
  getById,
  list,
  remove,
  statistics,
  update,
  upsert,
} from './network.controller.js';

export const networkRoutes = Router();

networkRoutes.use(authenticate);

networkRoutes.get('/', list);
// Static and nested routes must be registered before '/:id'.
networkRoutes.get('/statistics', statistics);
networkRoutes.get('/asset/:assetId', byAsset);
networkRoutes.get('/:id', getById);
networkRoutes.post('/', requireRole('ADMIN'), upsert);
networkRoutes.put('/:id', requireRole('ADMIN'), update);
networkRoutes.delete('/:id', requireRole('ADMIN'), remove);
networkRoutes.post('/:id/check', requireRole('ADMIN'), check);
