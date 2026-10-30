import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dot, underscore, or dash'),
  email: z.string().trim().email('Invalid email format').max(255),
  // bcrypt only uses the first 72 bytes; reject longer input instead of
  // silently truncating it.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  role: z.enum(['ADMIN', 'TECHNICIAN']).default('TECHNICIAN'),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(50),
  password: z.string().min(1, 'Password is required').max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
