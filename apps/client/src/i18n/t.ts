import { useSyncExternalStore } from 'react';
import bn from './bn.json';
import en from './en.json';

export type Lang = 'bn' | 'en';

export const LANGS: readonly Lang[] = ['bn', 'en'];
const DEFAULT_LANG: Lang = 'bn';
const STORAGE_KEY = 'carrom.lang';
const DICTS: Record<Lang, Record<string, string>> = { bn, en };

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'bn' || v === 'en' ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

let current: Lang = readStored();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage blocked (private window etc.): the choice lasts this session only.
  }
  listeners.forEach((fn) => fn());
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-renders the calling component when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}

/** Look up `key` in the current language and fill `{name}` placeholders. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m);
}
