import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  byAsset,
  explain,
  list,
  predict,
  predictAll,
  riskSummary,
} from './ai.controller.js';

export const aiRoutes = Router();

aiRoutes.use(authenticate);

aiRoutes.get('/predictions', list);
// Must stay before any '/predictions/:id' route; there is none today, but the
// literal segment is the safer ordering.
aiRoutes.get('/predictions/asset/:assetId', byAsset);
aiRoutes.get('/risk-summary', riskSummary);
aiRoutes.get('/explain/:assetId', explain);
aiRoutes.post('/predict-batch', requireRole('ADMIN'), predictAll);
aiRoutes.post('/predict/:assetId', requireRole('ADMIN'), predict);
