import jwt from 'jsonwebtoken';

/** AUTH-6: tokens last 7 days. */
export const TOKEN_TTL = '7d';
const ALGORITHM = 'HS256';

export interface TokenClaims {
  /** The user's id. */
  sub: string;
}

/** AUTH-8: sign a token for `userId`. The secret comes from env (no fallback). */
export function signToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: TOKEN_TTL, algorithm: ALGORITHM });
}

/**
 * AUTH-8: the token's claims, or null when it is missing, malformed, expired
 * or signed with another secret/algorithm. Also used by Colyseus `onAuth`.
 */
export function verifyToken(token: string | undefined, secret: string): TokenClaims | null {
  if (!token) return null;
  try {
    const claims = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
    if (typeof claims === 'string' || typeof claims.sub !== 'string' || claims.sub === '') return null;
    return { sub: claims.sub };
  } catch {
    return null;
  }
}

/** The token from an `Authorization: Bearer <token>` header, if any. */
export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m?.[1];
}
