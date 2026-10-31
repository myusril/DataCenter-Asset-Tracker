import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { signToken, verifyToken } from '../jwt.js';

const payload = { sub: 7, username: 'admin', role: 'ADMIN' as const };

describe('token verification', () => {
  it('round-trips a token signed by signToken', () => {
    const token = signToken(payload);
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it('rejects an unsigned token with alg "none"', () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    expect(() => verifyToken(`${header}.${body}.`)).toThrow();
  });

  it('rejects a token signed with a different HMAC algorithm', () => {
    const forged = jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS512' });
    expect(() => verifyToken(forged)).toThrow();
  });

  it('rejects a token signed with another secret', () => {
    const forged = jwt.sign(payload, `${env.JWT_SECRET}-other`, { algorithm: 'HS256' });
    expect(() => verifyToken(forged)).toThrow();
  });
});
