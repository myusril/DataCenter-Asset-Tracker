import { z } from 'zod';
import { optionalText } from '../../utils/validation.js';
import { connectionStatusSchema } from '../asset/asset.schema.js';

export const upsertNetworkSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  hostname: optionalText(100),
  ipAddress: optionalText(45),
  subnetMask: optionalText(45),
  gateway: optionalText(45),
  macAddress: optionalText(17),
  connectionStatus: connectionStatusSchema.optional(),
  notes: optionalText(500),
});

export const updateNetworkSchema = upsertNetworkSchema.omit({ assetId: true }).partial();

export const listNetworkQuerySchema = z.object({
  connectionStatus: connectionStatusSchema.optional(),
  search: optionalText(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type UpsertNetworkInput = z.infer<typeof upsertNetworkSchema>;
export type UpdateNetworkInput = z.infer<typeof updateNetworkSchema>;
export type ListNetworkQuery = z.infer<typeof listNetworkQuerySchema>;
