import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

/** AUTH-7: 20 requests per minute per IP on /auth/*. */
export const AUTH_RATE_LIMIT = 20;
export const AUTH_RATE_WINDOW_MS = 60_000;
export const RATE_LIMITED = 'Too many requests. Try again in a minute.';

/** A fresh limiter (its own in-memory counts) for each app. */
export function authRateLimit(limit = AUTH_RATE_LIMIT): RequestHandler {
  return rateLimit({
    windowMs: AUTH_RATE_WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: RATE_LIMITED },
  });
}
