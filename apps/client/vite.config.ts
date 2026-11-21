import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { appNameFor, GAME_APP_NAMES } from './src/constants/brand';

/** Hosts a phone can't reach: they mean the phone itself. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

/**
 * APP-5: a device build (`--mode android`, reads `.env.android`) must point at
 * a server the phone can reach. Stop the build with one clear message if not.
 */
function checkAndroidEnv(env: Record<string, string>): void {
  const raw = (env.VITE_API_BASE_URL ?? '').trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('APP-5: set VITE_API_BASE_URL in apps/client/.env.android (copy .env.android.example).');
  }
  if (LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`APP-5: VITE_API_BASE_URL in .env.android must not be ${url.hostname}; on a phone that is the phone itself.`);
  }
}

/** HAPP-3 VITE_APP_GAMES is `all` (or unset) or one game id; anything else stops the build. */
function checkAppGames(raw: string | undefined): void {
  const v = (raw ?? '').trim();
  const ids = Object.keys(GAME_APP_NAMES);
  if (v !== '' && v !== 'all' && !ids.includes(v)) {
    throw new Error(`HAPP-3: VITE_APP_GAMES must be "all" or one of ${ids.join(', ')} (got "${v}").`);
  }
}

/** HAPP-4 the page title is the app's name (the hub, or the one game's app). */
function appTitle(appGames: string | undefined): Plugin {
  const name = appNameFor(appGames).en;
  return { name: 'app-title', transformIndexHtml: (html) => html.replace('%APP_NAME%', name) };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'android') checkAndroidEnv(env);
  checkAppGames(env.VITE_APP_GAMES);
  return {
    plugins: [react(), tailwindcss(), appTitle(env.VITE_APP_GAMES)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { host: true },
  };
});
