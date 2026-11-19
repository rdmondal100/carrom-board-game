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

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  MONGODB_URL: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  JWT_SECRET: z.string().min(JWT_SECRET_MIN, `must be at least ${JWT_SECRET_MIN} characters`),
  CORS_ORIGIN: origins,
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
