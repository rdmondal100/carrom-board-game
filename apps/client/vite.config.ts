import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

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

export default defineConfig(({ mode }) => {
  if (mode === 'android') checkAndroidEnv(loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { host: true },
  };
});
