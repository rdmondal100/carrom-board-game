import { Redis } from 'ioredis';
import { logger } from './logger.js';

export type { Redis };

/** RANK-2: the Redis connection that holds the ranked queue. */
export function connectRedis(url: string): Redis {
  const redis = new Redis(url, { maxRetriesPerRequest: 3 });
  redis.on('error', (err: unknown) => logger.error('redis error', err));
  return redis;
}
