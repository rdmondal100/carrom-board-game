import bcrypt from 'bcryptjs';
import type { Request, RequestHandler, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import type { AuthResponse, MeResponse } from '@carrom/protocol/api';
import { authedUserId } from '../middleware/auth.middleware.js';
import {
  AVATAR_COUNT, BCRYPT_COST, guestName, isDuplicateKey, NAME_MAX, NAME_MIN, PASSWORD_MAX_BYTES,
  PASSWORD_MIN, toPublicUser, User, type UserDoc,
} from '../models/user.model.js';
import { verifyGoogleIdToken, type GoogleIdentity } from '../utils/google.js';
import { signToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

export interface AuthConfig {
  jwtSecret: string;
  googleClientIds: string[];
}

export const BAD_LOGIN = 'Wrong email or password';
export const EMAIL_TAKEN = 'That email is already registered';
export const BAD_GOOGLE = 'Google sign-in failed';
export const GOOGLE_OFF = 'Google sign-in is not set up on this server';

// ---- input -----------------------------------------------------------------

const nameSchema = z.string().trim()
  .min(NAME_MIN, `Name must be ${NAME_MIN}–${NAME_MAX} characters`)
  .max(NAME_MAX, `Name must be ${NAME_MIN}–${NAME_MAX} characters`)
  .regex(/^[^\p{Cc}\p{Cf}]*$/u, 'Name has characters that are not allowed');
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));
const passwordSchema = z.string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .refine((p) => Buffer.byteLength(p, 'utf8') <= PASSWORD_MAX_BYTES, 'Password is too long');

const guestBody = z.object({ name: nameSchema.optional() });
const registerBody = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
const loginBody = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });
const googleBody = z.object({ idToken: z.string().min(1, 'idToken is required') });
const patchBody = z.strictObject({
  name: nameSchema.optional(),
  avatar: z.number().int().min(0).max(AVATAR_COUNT - 1, 'Unknown avatar').optional(),
});

/** Parse the body; on failure answer 400 with the first problem and return null. */
function parseBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const r = schema.safeParse(req.body ?? {});
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const field = issue?.path.join('.') ?? '';
  const where = issue?.code === 'invalid_type' && field ? `${field}: ` : '';
  res.status(400).json({ error: `${where}${issue?.message ?? 'Bad request'}` });
  return null;
}

// ---- helpers ---------------------------------------------------------------

async function findUser(id: string | undefined): Promise<UserDoc | null> {
  if (!id || !isValidObjectId(id)) return null;
  return User.findById(id);
}

function sendAuth(res: Response, status: number, user: UserDoc, cfg: AuthConfig): void {
  const body: AuthResponse = { token: signToken(user.id as string, cfg.jwtSecret), user: toPublicUser(user) };
  res.status(status).json(body);
}

function fail(res: Response, what: string, err: unknown): void {
  logger.error(`${what} failed`, err);
  res.status(500).json({ error: `${what} failed` });
}

/** Hash compared against when the email is unknown, so both 401s take as long. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => (dummyHash ??= bcrypt.hash('not-a-real-password', BCRYPT_COST));

/** A Google display name as a valid player name, else a guest name. */
function nameFromGoogle(name: string | null): string {
  const r = nameSchema.safeParse((name ?? '').trim().slice(0, NAME_MAX));
  return r.success ? r.data : guestName();
}

// ---- handlers --------------------------------------------------------------

/** AUTH-2 POST /auth/guest { name? } */
export const guest = (cfg: AuthConfig): RequestHandler => async (req, res) => {
  try {
    const body = parseBody(guestBody, req, res);
    if (!body) return;
    const user = await User.create({ name: body.name ?? guestName(), isGuest: true });
    sendAuth(res, 201, user, cfg);
  } catch (err) {
    fail(res, 'Guest sign-in', err);
  }
};

/** AUTH-3 POST /auth/register { name, email, password }; a guest's token upgrades that guest. */
export const register = (cfg: AuthConfig): RequestHandler => async (req, res) => {
  try {
    const body = parseBody(registerBody, req, res);
    if (!body) return;
    if (await User.exists({ email: body.email })) {
      res.status(409).json({ error: EMAIL_TAKEN });
      return;
    }
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
    const caller = await findUser(authedUserId(res));
    const upgrade = caller?.isGuest === true;
    let user: UserDoc;
    if (caller && upgrade) {
      caller.set({ name: body.name, email: body.email, passwordHash, isGuest: false });
      user = await caller.save();
    } else {
      user = await User.create({ name: body.name, email: body.email, passwordHash, isGuest: false });
    }
    sendAuth(res, upgrade ? 200 : 201, user, cfg);
  } catch (err) {
    if (isDuplicateKey(err)) res.status(409).json({ error: EMAIL_TAKEN });
    else fail(res, 'Register', err);
  }
};

/** AUTH-4 POST /auth/login { email, password }: one 401 message for every mismatch. */
export const login = (cfg: AuthConfig): RequestHandler => async (req, res) => {
  try {
    const body = parseBody(loginBody, req, res);
    if (!body) return;
    const user = body.email ? await User.findOne({ email: body.email }) : null;
    const hash = user?.passwordHash ?? await getDummyHash();
    const ok = await bcrypt.compare(body.password, hash);
    if (!user?.passwordHash || !ok) {
      res.status(401).json({ error: BAD_LOGIN });
      return;
    }
    sendAuth(res, 200, user, cfg);
  } catch (err) {
    fail(res, 'Login', err);
  }
};

/**
 * AUTH-5 POST /auth/google { idToken }: by googleId; else link the user with
 * the same verified email; else upgrade the calling guest; else a new user.
 */
export const google = (cfg: AuthConfig): RequestHandler => async (req, res) => {
  try {
    const body = parseBody(googleBody, req, res);
    if (!body) return;
    if (cfg.googleClientIds.length === 0) {
      res.status(503).json({ error: GOOGLE_OFF });
      return;
    }
    let id: GoogleIdentity;
    try {
      id = await verifyGoogleIdToken(body.idToken, cfg.googleClientIds);
    } catch {
      res.status(401).json({ error: BAD_GOOGLE });
      return;
    }

    const known = await User.findOne({ googleId: id.googleId });
    if (known) return sendAuth(res, 200, known, cfg);

    const byEmail = id.email ? await User.findOne({ email: id.email }) : null;
    if (byEmail) {
      byEmail.set({ googleId: id.googleId, isGuest: false });
      return sendAuth(res, 200, await byEmail.save(), cfg);
    }

    const caller = await findUser(authedUserId(res));
    if (caller?.isGuest) {
      caller.set({ googleId: id.googleId, isGuest: false, ...(id.email ? { email: id.email } : {}) });
      return sendAuth(res, 200, await caller.save(), cfg);
    }

    const user = await User.create({
      name: nameFromGoogle(id.name), googleId: id.googleId, isGuest: false,
      ...(id.email ? { email: id.email } : {}),
    });
    sendAuth(res, 201, user, cfg);
  } catch (err) {
    if (isDuplicateKey(err)) res.status(409).json({ error: EMAIL_TAKEN });
    else fail(res, 'Google sign-in', err);
  }
};

/** AUTH-6 GET /auth/me */
export const getMe: RequestHandler = async (_req, res) => {
  try {
    const user = await findUser(authedUserId(res));
    if (!user) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    const body: MeResponse = { user: toPublicUser(user) };
    res.status(200).json(body);
  } catch (err) {
    fail(res, 'Loading your profile', err);
  }
};

/** AUTH-6 PATCH /auth/me { name?, avatar? } */
export const patchMe: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(patchBody, req, res);
    if (!body) return;
    const user = await findUser(authedUserId(res));
    if (!user) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    if (body.name !== undefined) user.name = body.name;
    if (body.avatar !== undefined) user.avatar = body.avatar;
    await user.save();
    const out: MeResponse = { user: toPublicUser(user) };
    res.status(200).json(out);
  } catch (err) {
    fail(res, 'Saving your profile', err);
  }
};
