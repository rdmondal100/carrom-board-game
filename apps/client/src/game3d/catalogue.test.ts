import { describe, expect, it } from 'vitest';
import { COSMETIC_GAMES, COSMETICS, itemsForGame } from '@carrom/protocol';
import { CB_ASSET_KEYS } from '@/games/callbreak/skins';
import { CARROM_ASSET_KEYS } from '@/games/carrom/skins';
import { LUDO_ASSET_KEYS } from '@/games/ludo/skins';
import { NODI_ASSET_KEYS } from '@/games/nodipar/skins';
import bn from '@/i18n/bn.json';
import en from '@/i18n/en.json';
import { isShowcaseItem, itemFinish } from './itemFinish';

const KNOWN = new Set([...CARROM_ASSET_KEYS, ...LUDO_ASSET_KEYS, ...CB_ASSET_KEYS, ...NODI_ASSET_KEYS]);

describe('3D catalogue', () => {
  it('T3D-8 every item has a look (no silent fallback to classic) and a bn and en name', () => {
    for (const c of COSMETICS) {
      expect(KNOWN.has(c.assetKey), c.assetKey).toBe(true);
      expect((en as Record<string, string>)[`item.${c.id}`], c.id).toBeTruthy();
      expect((bn as Record<string, string>)[`item.${c.id}`], c.id).toBeTruthy();
    }
  });

  it('T3D-8 every game has several free looks and paid 3D showcase looks', () => {
    for (const g of COSMETIC_GAMES) {
      const items = itemsForGame(g);
      expect(items.filter((c) => c.price === 0).length, g).toBeGreaterThan(GAME_SLOT_COUNT[g] ?? 0);
      expect(items.filter((c) => c.price > 0 && isShowcaseItem(c)).length, g).toBeGreaterThanOrEqual(2);
    }
  });

  it('T3D-8 the new premium sets carry their 3D finish', () => {
    const f = (id: string) => itemFinish(COSMETICS.find((c) => c.id === id)!);
    expect(f('crystal-striker')).toBe('glass');
    expect(f('gold-silver-coins')).toBe('metal');
    expect(f('marble-board')).toBe('marble');
    expect(f('crystal-tokens')).toBe('glass');
    expect(f('gold-foil-card-back')).toBe('metal');
    expect(f('crystal-boat')).toBe('glass');
  });
});

/** Slots per game: more free items than slots means at least one extra free choice. */
const GAME_SLOT_COUNT: Record<string, number> = { carrom: 3, ludo: 3, callbreak: 2, nodipar: 2 };
