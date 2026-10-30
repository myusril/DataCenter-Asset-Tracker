import type { RequestHandler } from 'express';
import { AppError, sendSuccess } from '../../utils/response.js';
import {
  createAssetSchema,
  idParamSchema,
  listAssetQuerySchema,
  updateAssetSchema,
} from './asset.schema.js';
import {
  createAsset,
  deleteAsset,
  getAssetById,
  getAssetStatistics,
  listAssets,
  updateAsset,
} from './asset.service.js';

export const list: RequestHandler = async (req, res) => {
  const query = listAssetQuerySchema.parse(req.query);
  const result = await listAssets(query);
  sendSuccess(res, result, 'Assets retrieved successfully');
};

export const statistics: RequestHandler = async (_req, res) => {
  const result = await getAssetStatistics();
  sendSuccess(res, result, 'Asset statistics retrieved successfully');
};

export const getById: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const asset = await getAssetById(id);
  sendSuccess(res, asset, 'Asset retrieved successfully');
};

export const create: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  const input = createAssetSchema.parse(req.body);
  const asset = await createAsset(input, req.user.id);
  sendSuccess(res, asset, 'Asset created successfully', 201);
};

export const update: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const input = updateAssetSchema.parse(req.body);
  const asset = await updateAsset(id, input);
  sendSuccess(res, asset, 'Asset updated successfully');
};

export const remove: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  await deleteAsset(id);
  sendSuccess(res, null, 'Asset deleted successfully');
};
