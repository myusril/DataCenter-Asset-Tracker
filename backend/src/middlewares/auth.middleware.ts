import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Resolves the bearer token to a live user. Loading the row on every request
 * means a deactivated account loses access immediately instead of at token
 * expiry.
 */
async function resolveAuthUser(authorizationHeader: string | undefined): Promise<AuthUser> {
  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    throw new AppError(401, 'Authentication required');
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new AppError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'Invalid or expired token');
  }

  return { id: user.id, username: user.username, role: user.role };
}

/** Rejects requests without a valid `Authorization: Bearer <token>` header. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    req.user = await resolveAuthUser(req.headers.authorization);
    next();
  } catch (error) {
    next(error);
  }
};

/** Like `authenticate`, but anonymous requests continue without a user. */
export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  if (!req.headers.authorization) {
    next();
    return;
  }

  try {
    req.user = await resolveAuthUser(req.headers.authorization);
    next();
  } catch (error) {
    next(error);
  }
};

/** Allows only the listed roles. Must run after `authenticate`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'You do not have permission to perform this action'));
      return;
    }
    next();
  };
}
