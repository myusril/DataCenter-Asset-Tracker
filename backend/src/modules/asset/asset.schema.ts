import { z } from 'zod';
import { idParamSchema, optionalText } from '../../utils/validation.js';

export const assetTypeSchema = z.enum([
  'SERVER',
  'SWITCH',
  'ROUTER',
  'STORAGE',
  'FIREWALL',
  'RACK',
  'OTHER',
]);

export const assetStatusSchema = z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']);

export const connectionStatusSchema = z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']);

const isoDateSchema = z.string().date('Invalid date, expected YYYY-MM-DD');

export const locationInputSchema = z.object({
  dataCenter: z.string().trim().min(1, 'Data center is required').max(100),
  rack: optionalText(20),
  rackSlot: optionalText(20),
  floor: optionalText(20),
  room: optionalText(50),
});

export const networkInputSchema = z.object({
  hostname: optionalText(100),
  ipAddress: optionalText(45),
  subnetMask: optionalText(45),
  gateway: optionalText(45),
  macAddress: optionalText(17),
  connectionStatus: connectionStatusSchema.optional(),
  notes: optionalText(500),
});

export const createAssetSchema = z.object({
  assetCode: z
    .string()
    .trim()
    .min(1, 'Asset code is required')
    .max(30)
    .regex(/^[A-Za-z0-9._-]+$/, 'Asset code may only contain letters, numbers, dot, underscore, or dash'),
  assetName: z.string().trim().min(1, 'Asset name is required').max(100),
  assetType: assetTypeSchema,
  brand: optionalText(50),
  model: optionalText(50),
  serialNumber: optionalText(100),
  purchaseDate: isoDateSchema.optional(),
  warrantyEnd: isoDateSchema.optional(),
  status: assetStatusSchema.optional(),
  description: optionalText(1000),
  location: locationInputSchema.optional(),
  network: networkInputSchema.optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const listAssetQuerySchema = z.object({
  search: optionalText(100),
  type: assetTypeSchema.optional(),
  status: assetStatusSchema.optional(),
  rack: optionalText(20),
  sortBy: z.enum(['assetName', 'assetCode', 'createdAt', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export { idParamSchema };

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type ListAssetQuery = z.infer<typeof listAssetQuerySchema>;
