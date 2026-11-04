import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { updateMe } from './user.controller.js';

export const userRoutes = Router();

userRoutes.use(authenticate);

// No `/:id` route exists on purpose: a user can only edit their own profile.
userRoutes.patch('/me', updateMe);
