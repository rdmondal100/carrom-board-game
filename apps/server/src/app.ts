import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { loadEnv, type Env } from './env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { PingRoom } from './rooms/ping.room.js';
import { healthRouter } from './routes/health.route.js';

export type AppEnv = Pick<Env, 'CORS_ORIGIN' | 'NODE_ENV'>;

/** Express app with every route and middleware; no listening (supertest uses it directly). */
export function createApp(env: AppEnv = loadEnv()): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '32kb' }));

  app.use('/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler(env.NODE_ENV === 'production'));
  return app;
}

/**
 * One HTTP server for Express and Colyseus: Colyseus answers its matchmaking
 * routes and WebSocket upgrades, everything else goes to the Express app.
 * Call `gameServer.listen(port)` to start.
 */
export function createServer(env: AppEnv = loadEnv()): { httpServer: http.Server; gameServer: Server } {
  const app = createApp(env);
  const httpServer = http.createServer(app);
  restrictColyseusCors(env.CORS_ORIGIN);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false,
    gracefullyShutdown: false,
  });
  gameServer.define('ping', PingRoom);
  return { httpServer, gameServer };
}

/** Colyseus sends CORS headers on every request and allows any origin by default. */
function restrictColyseusCors(allowed: string[]): void {
  const controller = matchMaker.controller;
  delete (controller.DEFAULT_CORS_HEADERS as Record<string, string>)['Access-Control-Allow-Origin'];
  controller.getCorsHeaders = (headers: Headers): Record<string, string> => {
    const origin = headers.get('origin');
    return origin !== null && allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : { Vary: 'Origin' };
  };
}
