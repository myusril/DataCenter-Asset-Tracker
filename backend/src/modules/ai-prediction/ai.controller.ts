import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response.js';
import { idParamSchema } from '../../utils/validation.js';
import { batchPredictSchema, listPredictionQuerySchema } from './ai.schema.js';
import {
  explainAsset,
  getAssetPredictions,
  getRiskSummary,
  listPredictions,
  predictAsset,
  predictBatch,
} from './ai.service.js';

export const list: RequestHandler = async (req, res) => {
  const query = listPredictionQuerySchema.parse(req.query);
  const result = await listPredictions(query);
  sendSuccess(res, result, 'Predictions retrieved successfully');
};

export const byAsset: RequestHandler = async (req, res) => {
  const assetId = idParamSchema.parse(req.params.assetId);
  const result = await getAssetPredictions(assetId);
  sendSuccess(res, result, 'Asset predictions retrieved successfully');
};

export const riskSummary: RequestHandler = async (_req, res) => {
  const result = await getRiskSummary();
  sendSuccess(res, result, 'Risk summary retrieved successfully');
};

export const explain: RequestHandler = async (req, res) => {
  const assetId = idParamSchema.parse(req.params.assetId);
  const result = await explainAsset(assetId);
  sendSuccess(res, result, 'Risk explanation generated successfully');
};

export const predict: RequestHandler = async (req, res) => {
  const assetId = idParamSchema.parse(req.params.assetId);
  const result = await predictAsset(assetId);
  sendSuccess(res, result, 'Prediction generated successfully', 201);
};

export const predictAll: RequestHandler = async (req, res) => {
  const input = batchPredictSchema.parse(req.body ?? {});
  const result = await predictBatch(input);
  sendSuccess(res, result, 'Batch prediction completed');
};
