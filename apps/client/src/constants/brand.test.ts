import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { appNameFor, GAME_APP_NAMES, HUB_NAME } from './brand';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(src, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('HAPP-4 brand', () => {
  it('HAPP-4 no "Carrom Adda" string outside constants/brand.ts (src, i18n, index.html, capacitor.config.ts)', () => {
    const checked = [...files(src), join(client, 'index.html'), join(client, 'capacitor.config.ts')]
      .filter((f) => /\.(tsx?|json|html|css)$/.test(f) && !f.endsWith(join('constants', 'brand.ts')) && !f.endsWith('brand.test.ts'));
    expect(checked.length).toBeGreaterThan(50);
    const hits = checked.filter((f) => /carrom adda|ক্যারম আড্ডা/i.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(client, f))).toEqual([]);
  });

  it('HAPP-4 app name: the hub for all, the game app for one game', () => {
    expect(appNameFor('all')).toBe(HUB_NAME);
    expect(appNameFor(undefined)).toBe(HUB_NAME);
    expect(appNameFor('carrom')).toBe(GAME_APP_NAMES.carrom);
  });
});
