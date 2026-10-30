import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware.js';
import { login, me, register } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/register', optionalAuthenticate, register);
authRoutes.post('/login', login);
authRoutes.get('/me', authenticate, me);
