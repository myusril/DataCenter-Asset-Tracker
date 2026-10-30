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

export type ListNotificationQuery = z.infer<typeof listNotificationQuerySchema>;
