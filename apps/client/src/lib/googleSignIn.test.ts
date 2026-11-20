import { beforeEach, describe, expect, it, vi } from 'vitest';

const cap = vi.hoisted(() => ({ native: false, platform: 'web' }));
const social = vi.hoisted(() => ({ initialize: vi.fn(), login: vi.fn() }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => cap.native, getPlatform: () => cap.platform },
}));
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: social }));

const { GoogleCancelled, googleMode, nativeGoogleIdToken, resetGoogleForTests } = await import('./googleSignIn');

describe('googleSignIn', () => {
  beforeEach(() => {
    resetGoogleForTests();
    social.initialize.mockReset().mockResolvedValue(undefined);
    social.login.mockReset();
  });

  it('APP-6 picks native on Android', () => {
    cap.native = true;
    cap.platform = 'android';
    expect(googleMode()).toBe('native');
  });

  it('APP-6 picks web in a browser and on other platforms', () => {
    cap.native = false;
    cap.platform = 'web';
    expect(googleMode()).toBe('web');
    cap.native = true;
    cap.platform = 'ios';
    expect(googleMode()).toBe('web');
  });

  it('APP-6 native sign-in uses the web client ID and returns the ID token', async () => {
    social.login.mockResolvedValue({ provider: 'google', result: { responseType: 'online', idToken: 'jwt.token', accessToken: null } });
    await expect(nativeGoogleIdToken('web-client.apps.googleusercontent.com')).resolves.toBe('jwt.token');
    await nativeGoogleIdToken('web-client.apps.googleusercontent.com');
    expect(social.initialize).toHaveBeenCalledTimes(1);
    expect(social.initialize).toHaveBeenCalledWith({ google: { webClientId: 'web-client.apps.googleusercontent.com' } });
    expect(social.login).toHaveBeenCalledWith({ provider: 'google', options: {} });
  });

  it('APP-6 a closed account picker is GoogleCancelled; no token is an error', async () => {
    social.login.mockRejectedValueOnce(Object.assign(new Error('cancel'), { code: 'USER_CANCELLED' }));
    await expect(nativeGoogleIdToken('id')).rejects.toBeInstanceOf(GoogleCancelled);
    social.login.mockResolvedValueOnce({ provider: 'google', result: { responseType: 'online', idToken: null } });
    await expect(nativeGoogleIdToken('id')).rejects.not.toBeInstanceOf(GoogleCancelled);
  });
});
