import type { RequestHandler } from 'express';
import { AppError, sendSuccess } from '../../utils/response.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { getProfile, loginUser, registerUser } from './auth.service.js';

export const register: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await registerUser(input, req.user);
  sendSuccess(res, { user }, 'User registered successfully', 201);
};

export const login: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  sendSuccess(res, result, 'Login successful');
};

export const me: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  const user = await getProfile(req.user.id);
  sendSuccess(res, { user }, 'Profile retrieved successfully');
};
