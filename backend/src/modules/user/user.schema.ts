import { z } from 'zod';

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

/**
 * Self-service profile update. `strict` is deliberate: fields a user must not
 * change (`username`, `role`, `isActive`) are rejected with 400 instead of
 * being dropped silently, so a client can never believe it changed them.
 */
export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(100, 'Full name must be at most 100 characters')
      .optional(),
    email: z
      .string()
      .trim()
      .email('Invalid email format')
      .max(255, 'Email must be at most 255 characters')
      .optional(),
    password: newPassword.optional(),
    currentPassword: z
      .string()
      .min(1, 'Current password is required')
      .max(72, 'Current password must be at most 72 characters')
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.password !== undefined && value.currentPassword === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPassword'],
        message: 'Current password is required to set a new password',
      });
    }

    if (value.currentPassword !== undefined && value.password === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Provide a new password when sending the current password',
      });
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
