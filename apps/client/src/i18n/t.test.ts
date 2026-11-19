import { describe, expect, it } from 'vitest';
import bn from './bn.json';
import en from './en.json';
import { getLang, setLang, t } from './t';

describe('i18n', () => {
  it('BRD-9 bn.json and en.json have exactly the same keys', () => {
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
  });

  it('BRD-9 default language is bn', () => {
    expect(getLang()).toBe('bn');
    expect(t('app.title')).toBe(bn['app.title']);
  });

  it('BRD-9 t fills {vars}', () => {
    setLang('en');
    expect(t('det.progress', { done: 3, total: 1000 })).toBe('3 / 1000 runs');
    expect(t('sandbox.seatN', { n: 2 })).toBe('Seat 2');
    expect(t('sandbox.seatN')).toBe('Seat {n}');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(localStorage.getItem('carrom.lang')).toBe('en');
    setLang('bn');
  });
});
