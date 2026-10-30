import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { create, getById, list, remove, statistics, update } from './asset.controller.js';

export const assetRoutes = Router();

assetRoutes.use(authenticate);

assetRoutes.get('/', list);
// Must stay before '/:id', otherwise "statistics" is parsed as an id.
assetRoutes.get('/statistics', statistics);
assetRoutes.get('/:id', getById);
assetRoutes.post('/', requireRole('ADMIN'), create);
assetRoutes.put('/:id', requireRole('ADMIN'), update);
assetRoutes.delete('/:id', requireRole('ADMIN'), remove);
