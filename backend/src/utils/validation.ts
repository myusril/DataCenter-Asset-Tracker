import { z } from 'zod';

/** Optional text: trailing spaces trimmed, empty string treated as absent. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const idParamSchema = z.coerce.number().int().positive();
