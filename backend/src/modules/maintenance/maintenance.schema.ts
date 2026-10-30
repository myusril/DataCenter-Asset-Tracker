import { z } from 'zod';
import { optionalText } from '../../utils/validation.js';

export const maintenanceTypeSchema = z.enum([
  'ROUTINE',
  'REPAIR',
  'UPGRADE',
  'INSPECTION',
  'REPLACEMENT',
]);

const isoDateSchema = z.string().date('Invalid date, expected YYYY-MM-DD');

export const createMaintenanceSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  technicianId: z.coerce.number().int().positive().optional(),
  maintenanceType: maintenanceTypeSchema,
  maintenanceDate: isoDateSchema,
  description: optionalText(1000),
  result: optionalText(1000),
  cost: z.coerce.number().min(0).max(9999999999.99).optional(),
  nextSchedule: isoDateSchema.optional(),
});

export const updateMaintenanceSchema = createMaintenanceSchema
  .omit({ assetId: true })
  .partial();

export const listMaintenanceQuerySchema = z.object({
  type: maintenanceTypeSchema.optional(),
  assetId: z.coerce.number().int().positive().optional(),
  technicianId: z.coerce.number().int().positive().optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
export type ListMaintenanceQuery = z.infer<typeof listMaintenanceQuerySchema>;
