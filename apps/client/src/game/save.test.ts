import { beforeEach, describe, expect, it } from 'vitest';
import { shootLocal, startLocal } from './localGame';
import { loadGame, SAVE_KEY, saveGame } from './save';

// JSON stores -0 as 0; that is the only change a round trip makes.
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const game = () => startLocal({ format: '1v1', preset: 'colour', length: { kind: 'points', target: 29 }, seed: 3 }, ['Asha', 'Bilu'], true);

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('LOC-9 save → load round-trips, also after a shot', () => {
    const g = game();
    saveGame(g);
    expect(loadGame()).toEqual(plain(g));
    const next = shootLocal(g, { seat: g.state.turnSeat as 0 | 2, x: 0, dirX: 0, dirY: 1, power: 1 }).game;
    saveGame(next);
    expect(loadGame()).toEqual(plain(next));
  });

  it('LOC-9 missing save gives null', () => {
    expect(loadGame()).toBeNull();
  });

  it('LOC-9 corrupt save gives null and is discarded', () => {
    localStorage.setItem(SAVE_KEY, '{not json');
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();

    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, game: { names: 'x' } }));
    expect(loadGame()).toBeNull();

    const bad = JSON.parse(JSON.stringify({ v: 1, game: game() }));
    bad.game.state.board.pieces[0].x = 'oops';
    localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
    expect(loadGame()).toBeNull();

    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 99, game: game() }));
    expect(loadGame()).toBeNull();
  });
});
