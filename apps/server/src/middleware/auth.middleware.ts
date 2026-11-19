import type { RequestHandler, Response } from 'express';
import { bearerToken, verifyToken } from '../utils/jwt.js';

export const AUTH_REQUIRED = 'Sign in required';

/** AUTH-6: needs a valid `Authorization: Bearer <jwt>`; puts the user id in res.locals.userId. */
export function requireAuth(secret: string): RequestHandler {
  return (req, res, next) => {
    const claims = verifyToken(bearerToken(req.get('authorization')), secret);
    if (!claims) {
      res.status(401).json({ error: AUTH_REQUIRED });
      return;
    }
    res.locals.userId = claims.sub;
    next();
  };
}

/** Like requireAuth but never refuses: a missing or bad token just leaves no user id. */
export function optionalAuth(secret: string): RequestHandler {
  return (req, res, next) => {
    const claims = verifyToken(bearerToken(req.get('authorization')), secret);
    if (claims) res.locals.userId = claims.sub;
    next();
  };
}

/** The user id requireAuth / optionalAuth found, if any. */
export function authedUserId(res: Response): string | undefined {
  const id: unknown = res.locals.userId;
  return typeof id === 'string' ? id : undefined;
}
