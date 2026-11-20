import { z } from 'zod';

export const DEFAULT_PORT = 8080;
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
  /** IAP-3 Play Billing. Both or neither; neither = in-app purchases off (POST /iap/verify answers 503). */
  PLAY_PACKAGE_NAME: z.string().regex(/^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/, 'must be an Android package name').optional(),
  PLAY_SERVICE_ACCOUNT_JSON: serviceAccount.optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).superRefine((e, ctx) => {
  if ((e.PLAY_PACKAGE_NAME === undefined) !== (e.PLAY_SERVICE_ACCOUNT_JSON === undefined)) {
    const missing = e.PLAY_PACKAGE_NAME === undefined ? 'PLAY_PACKAGE_NAME' : 'PLAY_SERVICE_ACCOUNT_JSON';
    ctx.addIssue({ code: 'custom', path: [missing], message: 'must be set together with the other PLAY_ key' });
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
