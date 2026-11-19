const DEV_API_BASE = 'http://localhost:8080';

function readBase(): string {
  const raw: unknown = import.meta.env.VITE_API_BASE_URL;
  const base = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : DEV_API_BASE;
  return base.replace(/\/+$/, '');
}

/** AUTH-9: the server's base URL, from VITE_API_BASE_URL (no trailing slash). */
export const API_BASE = readBase();

/** Google web client ID from VITE_GOOGLE_CLIENT_ID; empty = no Google button. */
export const GOOGLE_CLIENT_ID: string = (() => {
  const raw: unknown = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof raw === 'string' ? raw.trim() : '';
})();
