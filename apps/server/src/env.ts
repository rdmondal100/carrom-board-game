import { z } from 'zod';

export const DEFAULT_PORT = 5000;
export const JWT_SECRET_MIN = 32;

const origins = z.string().transform((s, ctx) => {
  const list = s.split(',').map((o) => o.trim()).filter((o) => o.length > 0);
  if (list.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'must list at least one origin' });
    return z.NEVER;
  }
  for (const o of list) {
    if (!URL.canParse(o)) {
      ctx.addIssue({ code: 'custom', message: `"${o}" is not a URL origin` });
      return z.NEVER;
    }
  }
  return list;
});

/** Comma list; empty or missing = Google sign-in off (POST /auth/google answers 503). */
const clientIds = z.string().default('').transform((s) =>
  s.split(',').map((id) => id.trim()).filter((id) => id.length > 0));

const PACKAGE_NAME = /^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/;

/** HAPP-9 comma list of Android package names (one per app flavor); the first is the default. */
const packageNames = z.string().transform((s, ctx) => {
  const list = s.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  if (list.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'must list at least one package name' });
    return z.NEVER;
  }
  for (const p of list) {
    if (!PACKAGE_NAME.test(p)) {
      ctx.addIssue({ code: 'custom', message: `"${p}" is not an Android package name` });
      return z.NEVER;
    }
  }
  return [...new Set(list)];
});

/** VOICE-3 Google's public STUN server, used when STUN_URLS is not set. */
export const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
export const TURN_SECRET_MIN = 16;

/** VOICE-3 comma list of ICE server URLs, each with one of the given schemes. */
const iceUrls = (schemes: readonly string[]) => z.string().transform((s, ctx) => {
  const list = s.split(',').map((u) => u.trim()).filter((u) => u.length > 0);
  if (list.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'must list at least one URL' });
    return z.NEVER;
  }
  const bad = list.find((u) => !schemes.some((p) => u.startsWith(`${p}:`)));
  if (bad !== undefined) {
    ctx.addIssue({ code: 'custom', message: `"${bad}" must start with ${schemes.map((p) => `${p}:`).join(' or ')}` });
    return z.NEVER;
  }
  return [...new Set(list)];
});

/** IAP-3 the Play Developer API service account: only the two fields the JWT needs. */
export interface ServiceAccount { clientEmail: string; privateKey: string }

const serviceAccount = z.string().transform((s, ctx): ServiceAccount => {
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'must be the service account key JSON' });
    return z.NEVER;
  }
  const r = z.object({ client_email: z.string().min(1), private_key: z.string().min(1) }).safeParse(raw);
  if (!r.success) {
    ctx.addIssue({ code: 'custom', message: 'needs client_email and private_key' });
    return z.NEVER;
  }
  return { clientEmail: r.data.client_email, privateKey: r.data.private_key };
});

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  MONGODB_URL: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  /** RANK-2 the ranked queue. */
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must start with redis:// or rediss://'),
  JWT_SECRET: z.string().min(JWT_SECRET_MIN, `must be at least ${JWT_SECRET_MIN} characters`),
  CORS_ORIGIN: origins,
  GOOGLE_CLIENT_IDS: clientIds,
  /** IAP-3 / HAPP-9 Play Billing. Both or neither; neither = in-app purchases off (POST /iap/verify answers 503). */
  PLAY_PACKAGE_NAMES: packageNames.optional(),
  PLAY_SERVICE_ACCOUNT_JSON: serviceAccount.optional(),
  /** VOICE-3 coturn (REST shared-secret scheme). Both or neither; neither = STUN only. */
  TURN_URLS: iceUrls(['turn', 'turns']).optional(),
  TURN_SECRET: z.string().min(TURN_SECRET_MIN, `must be at least ${TURN_SECRET_MIN} characters`).optional(),
  STUN_URLS: iceUrls(['stun', 'stuns']).default(DEFAULT_STUN_URLS),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).superRefine((e, ctx) => {
  if ((e.PLAY_PACKAGE_NAMES === undefined) !== (e.PLAY_SERVICE_ACCOUNT_JSON === undefined)) {
    const missing = e.PLAY_PACKAGE_NAMES === undefined ? 'PLAY_PACKAGE_NAMES' : 'PLAY_SERVICE_ACCOUNT_JSON';
    ctx.addIssue({ code: 'custom', path: [missing], message: 'must be set together with the other PLAY_ key' });
  }
  if ((e.TURN_URLS === undefined) !== (e.TURN_SECRET === undefined)) {
    const missing = e.TURN_URLS === undefined ? 'TURN_URLS' : 'TURN_SECRET';
    ctx.addIssue({ code: 'custom', path: [missing], message: 'must be set together with the other TURN_ key' });
  }
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/** Parse and check the environment. Throws one EnvError that lists every bad key. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // Treat empty strings as missing, so `JWT_SECRET=` in .env reads as "required".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const r = EnvSchema.safeParse(cleaned);
  if (r.success) return r.data;
  const problems = r.error.issues.map((i) => {
    const key = i.path.join('.') || '(env)';
    return cleaned[key] === undefined ? `${key} is required` : `${key} ${i.message}`;
  });
  throw new EnvError(problems);
}
