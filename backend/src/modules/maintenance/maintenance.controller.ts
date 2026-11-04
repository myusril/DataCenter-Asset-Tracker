import type { RequestHandler } from 'express';
import { AppError, sendSuccess } from '../../utils/response.js';
import { idParamSchema } from '../../utils/validation.js';
import {
  createMaintenanceSchema,
  listMaintenanceQuerySchema,
  scheduleQuerySchema,
  updateMaintenanceSchema,
} from './maintenance.schema.js';
import {
  createMaintenance,
  createMaintenanceReminders,
  deleteMaintenance,
  getMaintenanceById,
  getMaintenancesByAsset,
  getMaintenanceSchedule,
  getMaintenanceStatistics,
  listMaintenances,
  updateMaintenance,
} from './maintenance.service.js';

export const list: RequestHandler = async (req, res) => {
  const query = listMaintenanceQuerySchema.parse(req.query);
  const result = await listMaintenances(query);
  sendSuccess(res, result, 'Maintenance records retrieved successfully');
};

export const statistics: RequestHandler = async (_req, res) => {
  const result = await getMaintenanceStatistics();
  sendSuccess(res, result, 'Maintenance statistics retrieved successfully');
};

export const schedule: RequestHandler = async (req, res) => {
  const query = scheduleQuerySchema.parse(req.query);
  const result = await getMaintenanceSchedule(query);
  sendSuccess(res, result, 'Maintenance schedule retrieved successfully');
};

export const runReminders: RequestHandler = async (_req, res) => {
  const result = await createMaintenanceReminders();
  sendSuccess(res, result, 'Maintenance reminders processed successfully');
};

export const byAsset: RequestHandler = async (req, res) => {
  const assetId = idParamSchema.parse(req.params.assetId);
  const result = await getMaintenancesByAsset(assetId);
  sendSuccess(res, result, 'Asset maintenance history retrieved successfully');
};

export const getById: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const row = await getMaintenanceById(id);
  sendSuccess(res, row, 'Maintenance record retrieved successfully');
};

export const create: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  const input = createMaintenanceSchema.parse(req.body);
  const row = await createMaintenance(input, req.user.id);
  sendSuccess(res, row, 'Maintenance record created successfully', 201);
};

export const update: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const input = updateMaintenanceSchema.parse(req.body);
  const row = await updateMaintenance(id, input);
  sendSuccess(res, row, 'Maintenance record updated successfully');
};

export const remove: RequestHandler = async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  await deleteMaintenance(id);
  sendSuccess(res, null, 'Maintenance record deleted successfully');
};
