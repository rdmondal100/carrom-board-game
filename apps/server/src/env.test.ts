import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, EnvError, loadEnv } from './env.js';

const good = {
  MONGODB_URL: 'mongodb://127.0.0.1:27017/carrom',
  JWT_SECRET: 'x'.repeat(32),
  REDIS_URL: 'redis://127.0.0.1:6379',
  CORS_ORIGIN: 'http://localhost:5173, capacitor://localhost,https://localhost',
};

function problems(source: Record<string, string | undefined>): string[] {
  try {
    loadEnv(source);
  } catch (err) {
    if (err instanceof EnvError) return err.problems;
    throw err;
  }
  return [];
}

describe('env', () => {
  it('SRV-1 parses a good environment with defaults', () => {
    const env = loadEnv(good);
    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:5173', 'capacitor://localhost', 'https://localhost']);
    expect(loadEnv({ ...good, PORT: '3000', NODE_ENV: 'production' }).PORT).toBe(3000);
  });

  it('SRV-1 missing JWT_SECRET fails with a message naming it', () => {
    expect(() => loadEnv({ ...good, JWT_SECRET: undefined })).toThrow(/JWT_SECRET is required/);
    expect(() => loadEnv({ ...good, JWT_SECRET: '' })).toThrow(/JWT_SECRET is required/);
  });

  it('SRV-1 short JWT_SECRET fails with a message naming it', () => {
    expect(() => loadEnv({ ...good, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET must be at least 32/);
    expect(() => loadEnv({ ...good, JWT_SECRET: 'x'.repeat(31) })).toThrow(EnvError);
  });

  it('SRV-1 lists every bad key in one message', () => {
    const p = problems({ PORT: 'abc', NODE_ENV: 'staging', CORS_ORIGIN: 'not a url' });
    const keys = p.map((line) => line.split(' ')[0]);
    expect(keys.sort()).toEqual(['CORS_ORIGIN', 'JWT_SECRET', 'MONGODB_URL', 'NODE_ENV', 'PORT', 'REDIS_URL']);
  });

  it('SRV-1 rejects a non-mongodb URL and an empty origin list', () => {
    expect(problems({ ...good, MONGODB_URL: 'http://x' })[0]).toMatch(/^MONGODB_URL/);
    expect(problems({ ...good, CORS_ORIGIN: ' , ' })[0]).toMatch(/^CORS_ORIGIN/);
  });
});

describe('env redis', () => {
  it('RANK-2 REDIS_URL is required and must be a redis URL', () => {
    expect(loadEnv(good).REDIS_URL).toBe('redis://127.0.0.1:6379');
    expect(loadEnv({ ...good, REDIS_URL: 'rediss://cache.example:6380' }).REDIS_URL).toBe('rediss://cache.example:6380');
    expect(problems({ ...good, REDIS_URL: undefined })).toEqual(['REDIS_URL is required']);
    expect(problems({ ...good, REDIS_URL: 'http://x' })[0]).toMatch(/^REDIS_URL must start/);
  });
});

describe('env google', () => {
  it('AUTH-5 GOOGLE_CLIENT_IDS is an optional comma list', () => {
    expect(loadEnv(good).GOOGLE_CLIENT_IDS).toEqual([]);
    expect(loadEnv({ ...good, GOOGLE_CLIENT_IDS: ' web.apps , android.apps,' }).GOOGLE_CLIENT_IDS)
      .toEqual(['web.apps', 'android.apps']);
  });
});
