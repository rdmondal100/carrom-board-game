import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

export type GoogleMode = 'native' | 'web';

/**
 * APP-6: the Android app signs in with Google's native account picker
 * (Credential Manager); the web keeps the @react-oauth/google button.
 */
export function googleMode(): GoogleMode {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? 'native' : 'web';
}

/** The person closed the account picker; not an error worth a toast. */
export class GoogleCancelled extends Error {}

let ready: { clientId: string; done: Promise<void> } | null = null;

function init(webClientId: string): Promise<void> {
  if (ready?.clientId !== webClientId) {
    ready = { clientId: webClientId, done: SocialLogin.initialize({ google: { webClientId } }) };
  }
  return ready.done;
}

/**
 * APP-6: native sign-in → Google ID token for the *web* client ID, so the
 * server's `/auth/google` checks it exactly like a web sign-in.
 * Throws GoogleCancelled when the picker is dismissed.
 */
export async function nativeGoogleIdToken(webClientId: string): Promise<string> {
  await init(webClientId);
  try {
    const { result } = await SocialLogin.login({ provider: 'google', options: {} });
    if (result.responseType === 'online' && result.idToken) return result.idToken;
  } catch (e) {
    if ((e as { code?: unknown }).code === 'USER_CANCELLED') throw new GoogleCancelled();
    throw e;
  }
  throw new Error('Google returned no ID token');
}

/** For tests: forget the initialised client. */
export function resetGoogleForTests(): void {
  ready = null;
}
