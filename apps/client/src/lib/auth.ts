import { readStorage, removeStorage, writeStorage } from './storage';

export const TOKEN_KEY = 'carrom.token';

/** AUTH-9: the saved JWT, or null. */
export function getToken(): string | null {
  const t = readStorage(TOKEN_KEY);
  return t && t.trim() !== '' ? t : null;
}

export function setToken(token: string): void {
  writeStorage(TOKEN_KEY, token);
}

export function clearToken(): void {
  removeStorage(TOKEN_KEY);
}

/** `Authorization: Bearer <token>` when signed in, else no headers. */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
