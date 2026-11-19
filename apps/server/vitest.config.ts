import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // One in-memory MongoDB for the run (downloads mongod on the first run).
    globalSetup: ['src/testMongo.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // The Colyseus test server binds a fixed port; keep files in one process.
    fileParallelism: false,
  },
});
