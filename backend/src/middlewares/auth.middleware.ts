import type { RequestHandler } from 'express';
import { AppError } from '../utils/response.js';
import { verifyToken, type UserRole } from '../utils/jwt.js';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
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

/** Rejects requests without a valid `Authorization: Bearer <token>` header. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
};

/** Allows only the listed roles. Must run after `authenticate`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
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
