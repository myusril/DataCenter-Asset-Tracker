import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'AI_ALERT',
  'MAINTENANCE_REMINDER',
  'SYSTEM',
  'INFO',
]);

export const listNotificationQuerySchema = z.object({
  isRead: z
    .enum(['true', 'false'], { message: 'isRead must be "true" or "false"' })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  type: notificationTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const deviceTokenSchema = z.object({
  token: z
    .string({ message: 'Token is required' })
    .min(20, 'Token must be at least 20 characters')
    .max(4096, 'Token must be at most 4096 characters'),
  platform: z.enum(['ANDROID', 'IOS'], {
    message: 'Platform must be "ANDROID" or "IOS"',
  }),
});

export const deleteDeviceTokenSchema = z.object({
  token: z
    .string()
    .min(20, 'Token must be at least 20 characters')
    .max(4096, 'Token must be at most 4096 characters')
    .optional(),
});

export type ListNotificationQuery = z.infer<typeof listNotificationQuerySchema>;
export type DeviceTokenInput = z.infer<typeof deviceTokenSchema>;
