import { useSyncExternalStore } from 'react';
import { setLanguage, type Lang } from '@/store/settingsSlice';
import { store } from '@/store/store';
import bn from './bn.json';
import en from './en.json';

export type { Lang };

export const LANGS: readonly Lang[] = ['bn', 'en'];
const DICTS: Record<Lang, Record<string, string>> = { bn, en };

/** UI-2: the language lives in the settings store. */
export function getLang(): Lang {
  return store.getState().settings.language;
}

export function setLang(lang: Lang): void {
  store.dispatch(setLanguage(lang));
}

/** Re-renders the calling component when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(store.subscribe, getLang, getLang);
}

/** Look up `key` in the current language and fill `{name}` placeholders. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = DICTS[getLang()][key] ?? DICTS.en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m);
}
