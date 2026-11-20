import { COSMETICS } from '@carrom/protocol';
import { describe, expect, it } from 'vitest';
import { PIECE_STYLES } from '@/constants/view';
import {
  BOARD_SKINS, boardPalette, COIN_SKINS, coinSkin, DEFAULT_SKINS, hex, localSkins, onlineSkins, STRIKER_SKINS,
  strikerStyle,
} from './skins';

describe('COS-6 skins', () => {
  it('COS-6 every catalogue item has a skin for its asset key', () => {
    const tables = { striker: STRIKER_SKINS, coins: COIN_SKINS, board: BOARD_SKINS } as const;
    for (const item of COSMETICS) expect(tables[item.type][item.assetKey], item.id).toBeDefined();
  });

  it('COS-6 unknown or wrong-slot ids draw the classic look', () => {
    expect(strikerStyle('nope')).toBe(PIECE_STYLES.striker);
    expect(strikerStyle('jade-coins')).toBe(PIECE_STYLES.striker);
    expect(coinSkin(undefined)).toBe(COIN_SKINS['coins.classic']);
    expect(boardPalette('royal-board')).toBe(BOARD_SKINS['board.royal']);
  });

  it('COS-6 online: striker per seat, coins of the board breaker, own board', () => {
    const players = [
      { seat: 0, striker: 'gold-striker', coinSet: 'neon-coins' },
      { seat: 2, striker: 'classic-striker', coinSet: 'jade-coins' },
    ];
    const s = onlineSkins(players, 2, 'teak-board');
    expect(s.strikers).toEqual(['gold-striker', 'classic-striker', 'classic-striker', 'classic-striker']);
    expect(s.coins).toBe('jade-coins');
    expect(s.board).toBe('teak-board');
    expect(onlineSkins(players, 0, undefined).coins).toBe('neon-coins');
    expect(onlineSkins([{ seat: 0, striker: 'hacked' }], 0, 'x').strikers[0]).toBe('classic-striker');
  });

  it('COS-6 local games use the player\'s own items on every seat', () => {
    expect(localSkins(undefined)).toBe(DEFAULT_SKINS);
    const s = localSkins({ striker: 'ruby-striker', coins: 'pearl-coins', board: 'midnight-board' });
    expect(s.strikers).toEqual(['ruby-striker', 'ruby-striker', 'ruby-striker', 'ruby-striker']);
    expect([s.coins, s.board]).toEqual(['pearl-coins', 'midnight-board']);
  });

  it('hex pads to six digits', () => {
    expect(hex(0x0b0b0b)).toBe('#0b0b0b');
  });
});
