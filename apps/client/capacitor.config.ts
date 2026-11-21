import type { CapacitorConfig } from '@capacitor/cli';
// Node loads this file with its own TypeScript stripping, so the import needs the .ts extension.
import { appNameFor } from './src/constants/brand.ts';

/**
 * APP-1: the Android app wraps the Vite build in `dist`.
 * HAPP-7: each flavor's real applicationId and launcher name come from
 * android/app/build.gradle; appName here follows the build's VITE_APP_GAMES.
 */
export const config: CapacitorConfig = {
  appId: 'com.carromadda.app',
  appName: appNameFor(process.env.VITE_APP_GAMES).en,
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
