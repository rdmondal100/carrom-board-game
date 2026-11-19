import { describe, expect, it } from 'vitest';
import bn from './bn.json';
import en from './en.json';
import { getLang, setLang, t } from './t';

describe('i18n', () => {
  it('UI-3 bn.json and en.json have exactly the same keys', () => {
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
  });

  it('UI-3 no empty values', () => {
    for (const dict of [bn, en] as Record<string, string>[]) {
      const empty = Object.entries(dict).filter(([, v]) => v.trim() === '').map(([k]) => k);
      expect(empty).toEqual([]);
    }
  });

  it('BRD-9 default language is bn', () => {
    expect(getLang()).toBe('bn');
    expect(t('app.title')).toBe(bn['app.title']);
  });

  it('BRD-9 t fills {vars}; UI-2 language comes from the store and is saved', () => {
    setLang('en');
    expect(t('det.progress', { done: 3, total: 1000 })).toBe('3 / 1000 runs');
    expect(t('sandbox.seatN', { n: 2 })).toBe('Seat 2');
    expect(t('sandbox.seatN')).toBe('Seat {n}');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(JSON.parse(localStorage.getItem('carrom.settings') ?? '{}').language).toBe('en');
    setLang('bn');
  });
});
