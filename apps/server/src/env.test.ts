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

describe('env play billing', () => {
  const account = JSON.stringify({ type: 'service_account', client_email: 'iap@proj.iam.gserviceaccount.com', private_key: 'KEY' });

  it('IAP-3 HAPP-9 PLAY_ keys are optional; PLAY_PACKAGE_NAMES is a comma list', () => {
    expect(loadEnv(good).PLAY_PACKAGE_NAMES).toBeUndefined();
    const env = loadEnv({ ...good, PLAY_PACKAGE_NAMES: 'com.carromadda.app', PLAY_SERVICE_ACCOUNT_JSON: account });
    expect(env.PLAY_PACKAGE_NAMES).toEqual(['com.carromadda.app']);
    expect(env.PLAY_SERVICE_ACCOUNT_JSON).toEqual({ clientEmail: 'iap@proj.iam.gserviceaccount.com', privateKey: 'KEY' });
    const two = loadEnv({ ...good, PLAY_PACKAGE_NAMES: ' com.carromadda.app , com.example.hub,', PLAY_SERVICE_ACCOUNT_JSON: account });
    expect(two.PLAY_PACKAGE_NAMES).toEqual(['com.carromadda.app', 'com.example.hub']);
  });

  it('IAP-3 bad service account JSON or a lone PLAY_ key fails fast', () => {
    const pkg = { PLAY_PACKAGE_NAMES: 'com.carromadda.app' };
    expect(problems({ ...good, ...pkg, PLAY_SERVICE_ACCOUNT_JSON: '{nope' })[0]).toMatch(/^PLAY_SERVICE_ACCOUNT_JSON must be/);
    expect(problems({ ...good, ...pkg, PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"x"}' })[0])
      .toMatch(/^PLAY_SERVICE_ACCOUNT_JSON needs client_email/);
    expect(problems({ ...good, ...pkg })).toEqual(['PLAY_SERVICE_ACCOUNT_JSON is required']);
    expect(problems({ ...good, PLAY_SERVICE_ACCOUNT_JSON: account })).toEqual(['PLAY_PACKAGE_NAMES is required']);
    expect(problems({ ...good, PLAY_PACKAGE_NAMES: 'com.carromadda.app,carrom', PLAY_SERVICE_ACCOUNT_JSON: account })[0])
      .toMatch(/^PLAY_PACKAGE_NAMES "carrom" is not an Android package name/);
    expect(problems({ ...good, PLAY_PACKAGE_NAMES: ' , ', PLAY_SERVICE_ACCOUNT_JSON: account })[0])
      .toMatch(/^PLAY_PACKAGE_NAMES must list at least one/);
  });

  it('VOICE-3 TURN keys: both or neither; STUN defaults to Google; URL schemes checked', () => {
    const env = loadEnv(good);
    expect(env.TURN_URLS).toBeUndefined();
    expect(env.STUN_URLS).toEqual(['stun:stun.l.google.com:19302']);
    const turn = loadEnv({ ...good, TURN_URLS: 'turn:t.example:3478, turns:t.example:5349', TURN_SECRET: 's'.repeat(16) });
    expect(turn.TURN_URLS).toEqual(['turn:t.example:3478', 'turns:t.example:5349']);
    expect(problems({ ...good, TURN_URLS: 'turn:t.example:3478' })).toEqual(['TURN_SECRET is required']);
    expect(problems({ ...good, TURN_SECRET: 's'.repeat(16) })).toEqual(['TURN_URLS is required']);
    expect(problems({ ...good, TURN_URLS: 'http://t', TURN_SECRET: 's'.repeat(16) })[0]).toMatch(/^TURN_URLS "http:\/\/t" must start with turn:/);
    expect(problems({ ...good, TURN_URLS: 'turn:t', TURN_SECRET: 'short' })[0]).toMatch(/^TURN_SECRET must be at least 16/);
    expect(problems({ ...good, STUN_URLS: 'turn:x' })[0]).toMatch(/^STUN_URLS/);
  });
});
