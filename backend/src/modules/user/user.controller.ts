import type { RequestHandler } from 'express';
import { AppError, sendSuccess } from '../../utils/response.js';
import { updateProfileSchema } from './user.schema.js';
import { updateOwnProfile } from './user.service.js';

export const updateMe: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  // Checked before Zod so an empty PATCH is one clear message instead of a
  // schema error that also lists every optional field.
  const body = req.body as unknown;
  if (
    typeof body !== 'object' ||
    body === null ||
    Object.keys(body).length === 0
  ) {
    throw new AppError(400, 'Validation failed', [
      { field: 'body', message: 'Provide at least one of fullName, email, or password' },
    ]);
  }
  const input = updateProfileSchema.parse(req.body);
  const user = await updateOwnProfile(req.user.id, input);
  sendSuccess(res, { user }, 'Profile updated successfully');
};
