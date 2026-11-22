import { afterEach, describe, expect, it } from 'vitest';
import { TURNS } from '@hub/nodipar';
import { demoStart, demoStep, DEMO_MOVES } from './demo';
import {
  botMove, botTurn, clockRuns, humanSeats, moveLocal, rematchLocal, sideLabel, startLocal, takeBack, timeoutLocal, vsBotResult,
  type LocalNodi,
} from './localNodi';
import { clearNodiSave, loadNodi, NODI_SAVE_KEY, saveNodi } from './save';
import { boatSkin, nodiLook, riverSkin } from './skins';

const names = ['Rina', 'Tuhin', 'Mitu', 'Sabbir'];
const vsBot = (): LocalNodi => startLocal({ players: 2, borsha: false }, names, ['human', 'easy', 'hard', 'easy'], true, 5);

describe('NODI-5 same device and vs bot', () => {
  afterEach(() => localStorage.clear());

  it('NODI-5 seats: a person and a bot; the bot moves for its seat; a refused move is null', () => {
    let g = vsBot();
    expect(humanSeats(g)).toEqual([0]);
    if (g.state.turnSeat === 0) {
      expect(botTurn(g)).toBeNull();
      expect(moveLocal(g, { kind: 'flick', boat: 0, dirX: 0, dirY: 1, power: 0.3 })).toBeNull(); // nothing on the river yet
      const step = moveLocal(g, { kind: 'launch', x: 0, dirX: 0, dirY: 1, power: 0.3 })!;
      expect(step.seat).toBe(0);
      expect(step.from).toBe(g.state);
      g = step.game;
    }
    expect(botTurn(g)).toBe('hard');
    const step = botMove(g, 1)!;
    expect(step.seat).toBe(2);
    expect(step.move).not.toBeNull();
    expect(step.game.state.turnSeat).toBe(0);
  });

  it('NODI-5 two timeouts in a row hand the seat to the bot until "take back control"', () => {
    let g = { ...vsBot(), players: ['human', 'human', 'human', 'human'] as LocalNodi['players'] };
    const seat = g.state.turnSeat;
    g = timeoutLocal(g).game;
    g = timeoutLocal(g).game; // the other seat
    const third = timeoutLocal(g);
    expect(third.move).toBeNull();
    expect(third.game.takeover).toEqual([seat]);
    expect(botTurn({ ...third.game, state: { ...third.game.state, turnSeat: seat } })).toBe('medium');
    expect(takeBack(third.game, seat).takeover).toEqual([]);
    expect(clockRuns(g)).toBe(true);
  });

  it('NODI-5 a vs-bot win counts for coins; a people-only game does not', () => {
    const g = vsBot();
    expect(vsBotResult({ ...g, state: { ...g.state, winner: 'A' } })).toBe(true);
    expect(vsBotResult({ ...g, state: { ...g.state, winner: 'B' } })).toBe(false);
    expect(vsBotResult({ ...g, players: ['human', 'human', 'human', 'human'], state: { ...g.state, winner: 'A' } })).toBeNull();
    expect(sideLabel({ players: 4, borsha: false }, names, 'B')).toBe('Tuhin & Sabbir');
    expect(rematchLocal(g).state.first).not.toBe(g.state.first);
  });

  it('NODI-5 the game is saved after a move and comes back the same; broken saves are ignored', () => {
    const g = vsBot();
    saveNodi(g);
    expect(loadNodi()).toEqual(g);
    localStorage.setItem(NODI_SAVE_KEY, JSON.stringify({ v: 1, game: { state: { config: { players: 3 } } } }));
    expect(loadNodi()).toBeNull();
    clearNodiSave();
    expect(loadNodi()).toBeNull();
  });
});

describe('NODI-6 how-to example and looks', () => {
  it('NODI-6 the animated example plays the same opening every time, then starts over', () => {
    const run = () => {
      const moves = [];
      let s = demoStart();
      for (let step = demoStep(s); step; step = demoStep(s)) {
        moves.push(step.move);
        s = step.next;
      }
      return moves;
    };
    const a = run();
    expect(a).toHaveLength(DEMO_MOVES);
    expect(run()).toEqual(a);
    expect(DEMO_MOVES).toBeLessThan(2 * TURNS);
  });

  it('NODI-6 boat and river skins: unknown or other-slot items draw the classic look', () => {
    expect(boatSkin('golden-boat')).not.toEqual(boatSkin(undefined));
    expect(boatSkin('moonlit-river')).toEqual(boatSkin(undefined));
    expect(riverSkin('nope')).toEqual(riverSkin('classic-river'));
    expect(nodiLook(undefined)).toEqual({ boat: boatSkin(undefined), river: riverSkin(undefined) });
  });
});
