import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type UserRole = 'ADMIN' | 'TECHNICIAN';

export interface TokenPayload {
  sub: number;
  username: string;
  role: UserRole;
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/** Verifies the signature and shape; throws when the token is unusable. */
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Malformed token payload');
  }

  const { sub, username, role } = decoded;

  if (
    typeof sub !== 'number' ||
    typeof username !== 'string' ||
    (role !== 'ADMIN' && role !== 'TECHNICIAN')
  ) {
    throw new Error('Malformed token payload');
  }

  return { sub, username, role };
}
