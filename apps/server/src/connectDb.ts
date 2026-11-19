import mongoose from 'mongoose';
import { logger } from './utils/logger.js';

export type DbState = 'up' | 'down';

export async function connectDb(url: string): Promise<void> {
  await mongoose.connect(url);
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

/** 'up' only while the default connection is open. */
export function dbState(): DbState {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected ? 'up' : 'down';
}
