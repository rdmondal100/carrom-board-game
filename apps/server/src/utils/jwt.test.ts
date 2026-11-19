import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { bearerToken, signToken, verifyToken } from './jwt.js';

const SECRET = 's'.repeat(32);

describe('jwt', () => {
  it('AUTH-8 signToken / verifyToken round trip', () => {
    const token = signToken('abc123', SECRET);
    expect(verifyToken(token, SECRET)).toEqual({ sub: 'abc123' });
  });

  it('AUTH-6 token lasts 7 days', () => {
    const claims = jwt.decode(signToken('u', SECRET)) as { iat: number; exp: number };
    expect(claims.exp - claims.iat).toBe(7 * 24 * 60 * 60);
  });

  it('AUTH-8 other secret, expired, garbage, missing → null', () => {
    expect(verifyToken(signToken('u', SECRET), 'o'.repeat(32))).toBeNull();
    const expired = jwt.sign({}, SECRET, { subject: 'u', expiresIn: -10 });
    expect(verifyToken(expired, SECRET)).toBeNull();
    expect(verifyToken('not.a.token', SECRET)).toBeNull();
    expect(verifyToken(undefined, SECRET)).toBeNull();
    expect(verifyToken(jwt.sign({}, SECRET), SECRET)).toBeNull(); // no subject
  });

  it('AUTH-8 rejects an unsigned (alg none) token', () => {
    const none = jwt.sign({}, '', { subject: 'u', algorithm: 'none' });
    expect(verifyToken(none, SECRET)).toBeNull();
  });

  it('AUTH-6 bearerToken reads the Authorization header', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('bearer  abc ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeUndefined();
    expect(bearerToken('Bearer')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});
