import { OAuth2Client } from 'google-auth-library';

/** What a verified Google ID token tells us. */
export interface GoogleIdentity {
  googleId: string;
  /** Only set when Google says the address is verified. */
  email: string | null;
  name: string | null;
}

const client = new OAuth2Client();

/**
 * AUTH-5: check a Google ID token's signature, expiry and audience (one of
 * `clientIds`). Throws when the token is not good.
 */
export async function verifyGoogleIdToken(idToken: string, clientIds: string[]): Promise<GoogleIdentity> {
  const ticket = await client.verifyIdToken({ idToken, audience: clientIds });
  const p = ticket.getPayload();
  if (!p?.sub) throw new Error('Google token has no subject');
  return {
    googleId: p.sub,
    email: p.email && p.email_verified === true ? p.email.toLowerCase() : null,
    name: p.name ?? null,
  };
}
