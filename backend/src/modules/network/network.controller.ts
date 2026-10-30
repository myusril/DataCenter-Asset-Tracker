import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response.js';
import { idParamSchema } from '../../utils/validation.js';
import {
  listNetworkQuerySchema,
  updateNetworkSchema,
  upsertNetworkSchema,
} from './network.schema.js';
import {
  checkNetwork,
  deleteNetwork,
  getNetworkByAsset,
  getNetworkById,
  getNetworkStatistics,
  listNetworkInformation,
  updateNetwork,
  upsertNetwork,
} from './network.service.js';

export const list: RequestHandler = async (req, res) => {
  const query = listNetworkQuerySchema.parse(req.query);
  const result = await listNetworkInformation(query);
  sendSuccess(res, result, 'Network information retrieved successfully');
};

export const statistics: RequestHandler = async (_req, res) => {
  const result = await getNetworkStatistics();
  sendSuccess(res, result, 'Network statistics retrieved successfully');
};

export const byAsset: RequestHandler = async (req, res) => {
  const assetId = idParamSchema.parse(req.params.assetId);
  const row = await getNetworkByAsset(assetId);
  sendSuccess(res, row, 'Asset network information retrieved successfully');
};

export const getById: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const row = await getNetworkById(id);
  sendSuccess(res, row, 'Network information retrieved successfully');
};

export const upsert: RequestHandler = async (req, res) => {
  const input = upsertNetworkSchema.parse(req.body);
  const row = await upsertNetwork(input);
  sendSuccess(res, row, 'Network information saved successfully');
};

export const update: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const input = updateNetworkSchema.parse(req.body);
  const row = await updateNetwork(id, input);
  sendSuccess(res, row, 'Network information updated successfully');
};

export const remove: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  await deleteNetwork(id);
  sendSuccess(res, null, 'Network information deleted successfully');
};

export const check: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const row = await checkNetwork(id);
  sendSuccess(res, row, 'Connection check completed');
};
