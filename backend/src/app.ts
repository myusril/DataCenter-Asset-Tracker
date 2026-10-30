import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { logger } from './utils/logger.js';
import { AppError, sendError, type ValidationIssue } from './utils/response.js';

function isPrismaError(error: unknown): error is { code: string } {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return typeof error.code === 'string' && /^P\d{4}$/.test(error.code);
}

function validationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    sendError(res, 'Validation failed', 400, validationIssues(error));
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode, error.errors);
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, 'Invalid JSON body', 400);
    return;
  }

  if (isPrismaError(error)) {
    switch (error.code) {
      case 'P2002':
        sendError(res, 'Duplicate value for a unique field', 409);
        return;
      case 'P2025':
        sendError(res, 'Record not found', 404);
        return;
      case 'P2003':
        sendError(res, 'Related record constraint failed', 409);
        return;
      default:
        logger.error(`Database error ${error.code}`);
        sendError(res, 'Database error', 500);
        return;
    }
  }

  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  sendError(res, 'Internal server error', 500);
};

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Expo dev clients run from a different origin; tokens travel in headers,
  // not cookies, so reflecting the origin is sufficient for local development.
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      data: {
        status: 'ok',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api/auth', authRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
