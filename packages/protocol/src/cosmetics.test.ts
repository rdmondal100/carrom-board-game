import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COSMETIC_GAMES, COSMETIC_TYPES, COSMETICS, cosmeticById, DEFAULT_EQUIPPED, DEFAULT_SLOTS, equippedEntries, fitsSlot,
  GAME_SLOTS, isSlotOf, itemOrDefault, itemsForGame, ownedItems, ownsItem, resolveEquipped, resolveEquippedMap,
  resolveGameSlots, type CosmeticGame,
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
      expect(Object.keys(item).sort()).toEqual(['assetKey', 'game', 'id', 'price', 'rarity', 'type']);
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
  it('COS-5 HAPP-5 T3D-8 each game slot has its free classic default; other free items are owned by everyone too', () => {
    for (const game of COSMETIC_GAMES) {
      for (const slot of GAME_SLOTS[game]) {
        const free = COSMETICS.filter((c) => c.game === game && c.type === slot && c.price === 0);
        const def = (DEFAULT_SLOTS[game] as Record<string, string>)[slot];
        expect(def).toMatch(/^classic-/);
        expect(free.map((c) => c.id)).toContain(def);
        for (const c of free) expect(ownsItem([], c.id), c.id).toBe(true);
      }
    }
    expect(DEFAULT_EQUIPPED).toEqual(DEFAULT_SLOTS.carrom);
    expect(COSMETIC_TYPES).toEqual(['striker', 'coins', 'board']);
  });

  it('HAPP-5 every item fits a slot of its game', () => {
    for (const c of COSMETICS) {
      const games = c.game === 'any' ? COSMETIC_GAMES.filter((g) => isSlotOf(g, c.type)) : [c.game];
      expect(games.length, c.id).toBeGreaterThan(0);
      for (const g of games) expect(fitsSlot(c, g, c.type), c.id).toBe(true);
    }
    expect(itemsForGame('carrom').every((c) => c.game === 'carrom')).toBe(true);
    // LUDO-8 ludo's items: token sets, board themes and dice, all for ludo only.
    expect(itemsForGame('ludo').map((c) => c.type)).toEqual(expect.arrayContaining(['tokens', 'board', 'dice']));
    expect(itemsForGame('ludo').every((c) => c.game === 'ludo')).toBe(true);
    expect(itemsForGame('ludo').filter((c) => c.price > 0).length).toBeGreaterThanOrEqual(6);
    // A carrom board never fits ludo's board slot.
    expect(fitsSlot(cosmeticById('teak-board'), 'ludo', 'board')).toBe(false);
    // CB-9 callbreak's items: card backs and tables, for callbreak only.
    const paid = (g: CosmeticGame, type: string) => itemsForGame(g).filter((c) => c.price > 0 && c.type === type).length;
    expect(paid('callbreak', 'cardBack')).toBeGreaterThanOrEqual(3);
    expect(paid('callbreak', 'table')).toBeGreaterThanOrEqual(3);
    expect(itemsForGame('callbreak').every((c) => c.game === 'callbreak')).toBe(true);
    expect(fitsSlot(cosmeticById('night-ludo-board'), 'callbreak', 'table')).toBe(false);
    // NODI-6 nodi par's items: boat skins and river themes, for nodi par only.
    expect(paid('nodipar', 'boat')).toBeGreaterThanOrEqual(3);
    expect(paid('nodipar', 'river')).toBeGreaterThanOrEqual(3);
    expect(itemsForGame('nodipar').every((c) => c.game === 'nodipar')).toBe(true);
  });

  it('COS-5 everyone owns the defaults; bought ids count only if known', () => {
    expect(ownsItem([], 'classic-board')).toBe(true);
    expect(ownsItem([], 'gold-striker')).toBe(false);
    expect(ownsItem(['gold-striker'], 'gold-striker')).toBe(true);
    expect(ownsItem(['nope'], 'nope')).toBe(false);
    expect(ownedItems(['gold-striker', 'nope']).slice(0, 4)).toEqual(['classic-striker', 'gold-striker', 'classic-coins', 'classic-board']);
    expect(ownedItems([])).toContain('classic-tokens');
  });

  it('COS-5 resolveEquipped fills missing or unknown slots with defaults', () => {
    expect(resolveEquipped([])).toEqual(DEFAULT_EQUIPPED);
    expect(resolveEquipped(['gold-striker', 'jade-coins', 'junk'])).toEqual({
      striker: 'gold-striker', coins: 'jade-coins', board: 'classic-board',
    });
    expect(itemOrDefault('jade-coins', 'striker')).toBe('classic-striker');
    expect(itemOrDefault(undefined, 'board')).toBe('classic-board');
    expect(itemOrDefault('teak-board', 'board', 'ludo')).toBe('classic-ludo-board');
  });

  it('HAPP-5 an old equipped id list resolves to the carrom slots; other games get defaults', () => {
    const map = resolveEquippedMap(['gold-striker', 'jade-coins']);
    expect(map.carrom).toEqual({ striker: 'gold-striker', coins: 'jade-coins', board: 'classic-board' });
    expect(map.ludo).toEqual(DEFAULT_SLOTS.ludo);
    expect(map.callbreak).toEqual(DEFAULT_SLOTS.callbreak);
    expect(map.nodipar).toEqual(DEFAULT_SLOTS.nodipar);
  });

  it('HAPP-5 scoped entries only touch their own game; stored entries round-trip', () => {
    const old = ['gold-striker', 'teak-board'];
    const next = resolveEquippedMap(old);
    next.ludo.board = 'classic-ludo-board';
    const stored = equippedEntries(next);
    expect(stored).toContain('ludo:classic-ludo-board');
    expect(resolveEquippedMap(stored)).toEqual(next);
    expect(resolveEquippedMap(stored).carrom).toEqual(resolveEquippedMap(old).carrom);
    // An entry scoped to another game, or naming another game's item, is ignored.
    expect(resolveGameSlots(['ludo:gold-striker', 'carrom:classic-ludo-board'], 'carrom')).toEqual(DEFAULT_SLOTS.carrom);
  });
});
