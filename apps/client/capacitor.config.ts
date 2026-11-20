import type { CapacitorConfig } from '@capacitor/cli';

/**
 * APP-1: the Android app wraps the Vite build in `dist`.
 * The owner may change appId before the first Play upload (it can't change after).
 */
export const config: CapacitorConfig = {
  appId: 'com.carromadda.app',
  appName: 'Carrom Adda',
  webDir: 'dist',
  android: {
    // The WebView page is https://localhost, so the API must be https too (see ANDROID.md).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: { launchAutoHide: true },
    SocialLogin: { providers: { google: true, facebook: false, apple: false, twitter: false } },
  },
};

// The Capacitor CLI reads the default export (the only one in the project).
export default config;
