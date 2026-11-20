import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COSMETIC_TYPES, COSMETICS, DEFAULT_EQUIPPED, itemOrDefault, ownedItems, ownsItem, resolveEquipped,
} from './cosmetics';

const here = dirname(fileURLToPath(import.meta.url));
const PHYSICS_KEYS = ['r', 'm', 'mass', 'speed', 'friction', 'restitution', 'power'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.ts$/.test(f) ? [p] : [];
  });
}

describe('COS-1 catalogue', () => {
  it('COS-1 no catalogue item has physics-like keys', () => {
    for (const item of COSMETICS) {
      expect(Object.keys(item).sort()).toEqual(['assetKey', 'id', 'price', 'rarity', 'type']);
      for (const k of PHYSICS_KEYS) expect(item).not.toHaveProperty(k);
    }
  });

  it('COS-1 packages/engine has no import of protocol/cosmetics', () => {
    const engineSrc = join(here, '..', '..', 'engine', 'src');
    const files = sources(engineSrc);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/@carrom\/protocol|cosmetics/);
    }
  });

  it('COS-1 cosmetics.ts imports nothing', () => {
    expect(readFileSync(join(here, 'cosmetics.ts'), 'utf8')).not.toMatch(/^import /m);
  });

  it('COS-1 ids and asset keys are unique; prices are whole and not negative', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    expect(new Set(COSMETICS.map((c) => c.assetKey)).size).toBe(COSMETICS.length);
    for (const c of COSMETICS) expect(Number.isInteger(c.price) && c.price >= 0).toBe(true);
  });
});

describe('COS-5 defaults', () => {
  it('COS-5 each type has exactly one free default item, and it is the default equip', () => {
    for (const type of COSMETIC_TYPES) {
      const free = COSMETICS.filter((c) => c.type === type && c.price === 0);
      expect(free.map((c) => c.id)).toEqual([DEFAULT_EQUIPPED[type]]);
      expect(DEFAULT_EQUIPPED[type]).toMatch(/^classic-/);
    }
  });

  it('COS-5 everyone owns the defaults; bought ids count only if known', () => {
    expect(ownsItem([], 'classic-board')).toBe(true);
    expect(ownsItem([], 'gold-striker')).toBe(false);
    expect(ownsItem(['gold-striker'], 'gold-striker')).toBe(true);
    expect(ownsItem(['nope'], 'nope')).toBe(false);
    expect(ownedItems(['gold-striker', 'nope'])).toEqual(['classic-striker', 'gold-striker', 'classic-coins', 'classic-board']);
  });

  it('COS-5 resolveEquipped fills missing or unknown slots with defaults', () => {
    expect(resolveEquipped([])).toEqual(DEFAULT_EQUIPPED);
    expect(resolveEquipped(['gold-striker', 'jade-coins', 'junk'])).toEqual({
      striker: 'gold-striker', coins: 'jade-coins', board: 'classic-board',
    });
    expect(itemOrDefault('jade-coins', 'striker')).toBe('classic-striker');
    expect(itemOrDefault(undefined, 'board')).toBe('classic-board');
  });
});
