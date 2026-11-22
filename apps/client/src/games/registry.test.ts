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

  it('HAPP-1 LUDO-6 CB-7 NODI-5 carrom and ludo have every mode, callbreak vs bot and online, nodi par all but ranked', () => {
    const [carrom, ludo, callbreak, nodipar, ...rest] = ALL_GAMES;
    expect(callbreak!.id).toBe('callbreak');
    expect(callbreak!.playModes).toEqual({ local: false, bot: true, online: true, ranked: false });
    expect(Object.keys(callbreak!.routes).sort()).toEqual(Object.keys(carrom!.routes).sort());
    expect(callbreak!.CosmeticPreview).toBeDefined();
    expect(ludo!.id).toBe('ludo');
    expect(Object.values(ludo!.playModes).every(Boolean)).toBe(true);
    expect(Object.keys(ludo!.routes).sort()).toEqual(Object.keys(carrom!.routes).sort());
    expect(ludo!.CosmeticPreview).toBeDefined();
    expect(isPlayable(carrom!)).toBe(true);
    expect(Object.keys(carrom!.routes).sort()).toEqual(['howToPlay', 'lobby', 'localGame', 'onlineGame', 'online', 'setup'].sort());
    expect(carrom!.CosmeticPreview).toBeDefined();
    expect(nodipar!.id).toBe('nodipar');
    expect(nodipar!.playModes).toEqual({ local: true, bot: true, online: true, ranked: false });
    expect(Object.keys(nodipar!.routes).sort()).toEqual(Object.keys(carrom!.routes).sort());
    expect(nodipar!.CosmeticPreview).toBeDefined();
    expect(rest).toEqual([]);
  });

  it('HAPP-2 paths', () => {
    expect(gamePath('carrom')).toBe('/g/carrom/play');
    expect(modePath('carrom', 'local')).toBe('/g/carrom/local/setup');
    expect(modePath('carrom', 'bot')).toBe('/g/carrom/local/setup?vs=bot');
    expect(modePath('ludo', 'ranked')).toBe('/g/ludo/ranked');
  });
});
