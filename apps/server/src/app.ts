import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GAME_ROOM, QUEUE_ROOM, RANKED_ROOM } from '@carrom/protocol';
import { loadEnv, type Env } from './env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { authRateLimit } from './middleware/rateLimit.middleware.js';
import { gameRoomFor } from './rooms/game.room.js';
import { PingRoom } from './rooms/ping.room.js';
import { queueRoomFor } from './rooms/queue.room.js';
import { rankedRoomFor } from './rooms/rankedGame.room.js';
import type { RoomTiming } from './rooms/roomTiming.js';
import { authRouter } from './routes/auth.route.js';
import { healthRouter } from './routes/health.route.js';
import { leaderboardRouter } from './routes/leaderboard.route.js';
import { matchRouter } from './routes/match.route.js';
import { meRouter, shopRouter } from './routes/shop.route.js';
import { adsRouter } from './routes/ads.route.js';
import { googleKeys, type KeySource } from './utils/admobSsv.js';
import { roomRouter } from './routes/room.route.js';
import type { RankedTiming } from './utils/rankedConfig.js';
import type { Redis } from './utils/redis.js';

export type AppEnv = Pick<Env, 'CORS_ORIGIN' | 'NODE_ENV' | 'JWT_SECRET' | 'GOOGLE_CLIENT_IDS'>;

export interface AppOptions {
  /** AUTH-7 requests per minute per IP on /auth/* (tests raise it). */
  authRateLimit?: number;
  /** Game room waits (tests shorten them). */
  roomTiming?: RoomTiming;
  /** RANK-2 queue store; without it there is no ranked queue room. */
  redis?: Redis;
  /** Ranked queue waits (tests shorten them). */
  rankedTiming?: RankedTiming;
  /** AD-3 AdMob SSV public keys (tests use their own). */
  ssvKeys?: KeySource;
}

/** Express app with every route and middleware; no listening (supertest uses it directly). */
export function createApp(env: AppEnv = loadEnv(), opts: AppOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '32kb' }));

  app.use('/health', healthRouter);
  app.use('/rooms', roomRouter);
  app.use('/leaderboard', leaderboardRouter(env.JWT_SECRET));
  app.use('/matches', matchRouter(env.JWT_SECRET));
  app.use('/shop', shopRouter(env.JWT_SECRET));
  app.use('/me', meRouter(env.JWT_SECRET));
  app.use('/ads', adsRouter(env.JWT_SECRET, opts.ssvKeys ?? googleKeys()));
  app.use('/auth', authRouter(
    { jwtSecret: env.JWT_SECRET, googleClientIds: env.GOOGLE_CLIENT_IDS },
    authRateLimit(opts.authRateLimit),
  ));

  app.use(notFound);
  app.use(errorHandler(env.NODE_ENV === 'production'));
  return app;
}

/**
 * One HTTP server for Express and Colyseus: Colyseus answers its matchmaking
 * routes and WebSocket upgrades, everything else goes to the Express app.
 * Call `gameServer.listen(port)` to start.
 */
export function createServer(
  env: AppEnv = loadEnv(), opts: AppOptions = {},
): { httpServer: http.Server; gameServer: Server } {
  const app = createApp(env, opts);
  const httpServer = http.createServer(app);
  restrictColyseusCors(env.CORS_ORIGIN);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false,
    gracefullyShutdown: false,
  });
  gameServer.define('ping', PingRoom);
  gameServer.define(GAME_ROOM, gameRoomFor(env.JWT_SECRET, opts.roomTiming));
  gameServer.define(RANKED_ROOM, rankedRoomFor(env.JWT_SECRET, opts.roomTiming, opts.rankedTiming));
  if (opts.redis) gameServer.define(QUEUE_ROOM, queueRoomFor(env.JWT_SECRET, opts.redis, opts.rankedTiming));
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
