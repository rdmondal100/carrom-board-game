import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

/** Any route nobody answered: 404 { error }. */
export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
};

/**
 * Last error handler: 500 { error } (or the error's own 4xx status, e.g. a
 * bad JSON body). The stack is included only outside production.
 */
export function errorHandler(production: boolean): ErrorRequestHandler {
  return (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const e = err instanceof Error ? err : new Error(String(err));
    const status = statusOf(err);
    if (status >= 500) logger.error('request failed', e);
    const message = status >= 500 ? 'Internal server error' : e.message;
    res.status(status).json(production ? { error: message } : { error: message, stack: e.stack });
  };
}

function statusOf(err: unknown): number {
  if (typeof err === 'object' && err !== null) {
    const s = (err as { status?: unknown; statusCode?: unknown }).status
      ?? (err as { statusCode?: unknown }).statusCode;
    if (typeof s === 'number' && s >= 400 && s < 600) return s;
  }
  return 500;
}
