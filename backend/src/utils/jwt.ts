import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';

export type { Role };

export interface TokenPayload {
  sub: number;
  username: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/** Verifies the signature and shape; throws when the token is unusable. */
export function verifyToken(token: string): TokenPayload {
  // Pin the algorithm: accepting whatever the header announces enables
  // algorithm-confusion attacks even when the secret is strong.
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
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
