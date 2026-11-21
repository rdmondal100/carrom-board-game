import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '@hub/game-kit';
import { ALL_GAMES, BUILD_GAMES, gamesFor } from './registry';
import { gamePath, isPlayable, modePath } from './types';

describe('HAPP-1 / HAPP-3 game registry', () => {
  it('HAPP-1/3 VITE_APP_GAMES=carrom lists only carrom; all lists every built game', () => {
    expect(gamesFor('carrom').map((g) => g.id)).toEqual(['carrom']);
    expect(gamesFor('all').map((g) => g.id)).toEqual([...GAME_IDS]);
    expect(gamesFor(undefined).map((g) => g.id)).toEqual([...GAME_IDS]);
    expect(gamesFor(' ludo ').map((g) => g.id)).toEqual(['ludo']);
    expect(() => gamesFor('chess')).toThrow(/VITE_APP_GAMES/);
    // Tests run without VITE_APP_GAMES: the web build.
    expect(BUILD_GAMES).toHaveLength(ALL_GAMES.length);
  });

  it('HAPP-1 carrom is playable with every page; the others are coming-soon stubs', () => {
    const [carrom, ...rest] = ALL_GAMES;
    expect(isPlayable(carrom!)).toBe(true);
    expect(Object.keys(carrom!.routes).sort()).toEqual(['howToPlay', 'lobby', 'localGame', 'onlineGame', 'online', 'setup'].sort());
    expect(carrom!.CosmeticPreview).toBeDefined();
    for (const g of rest) {
      expect(isPlayable(g), g.id).toBe(false);
      expect(g.routes).toEqual({});
    }
  });

  it('HAPP-2 paths', () => {
    expect(gamePath('carrom')).toBe('/g/carrom/play');
    expect(modePath('carrom', 'local')).toBe('/g/carrom/local/setup');
    expect(modePath('carrom', 'bot')).toBe('/g/carrom/local/setup?vs=bot');
    expect(modePath('ludo', 'ranked')).toBe('/g/ludo/ranked');
  });
});
