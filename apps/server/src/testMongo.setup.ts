import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * Vitest global setup: one in-memory MongoDB for the whole run. Runs outside
 * the hook timeout, so the first run can download the mongod binary.
 */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const mongo = await MongoMemoryServer.create();
  project.provide('mongoUri', mongo.getUri());
  return async () => {
    await mongo.stop();
  };
}
