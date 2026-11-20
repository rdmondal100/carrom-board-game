import { createServer } from './app.js';
import { connectDb, disconnectDb } from './connectDb.js';
import { EnvError, loadEnv, type Env } from './env.js';
import { logger } from './utils/logger.js';
import { runMigrations } from './utils/migrations.js';
import { connectRedis } from './utils/redis.js';

function readEnv(): Env {
  try {
    return loadEnv();
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const env = readEnv();
  await connectDb(env.MONGODB_URL);
  // HUB-8: move pre-hub data (idempotent).
  await runMigrations();
  const redis = connectRedis(env.REDIS_URL);
  const { gameServer } = createServer(env, { redis });
  await gameServer.listen(env.PORT);
  logger.info(`Carrom Adda server on :${env.PORT} (${env.NODE_ENV})`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal}: shutting down`);
    await gameServer.gracefullyShutdown(false);
    await disconnectDb();
    await redis.quit().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.error('startup failed', err);
  process.exit(1);
});
