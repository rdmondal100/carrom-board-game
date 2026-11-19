import { describe, expect, it } from 'vitest';
import { simulateShot, type Seat, type ShotInput } from '@carrom/engine';
import { applyShot, applyTimeout, newGame, type GameConfig } from '@carrom/rules';
import { seatName, shootLocal, startLocal, timeoutLocal } from './localGame';

const CFG: GameConfig = { format: '2v2', preset: 'point', length: { kind: 'points', target: 300 }, seed: 7 };
const NAMES = ['Asha', 'Bilu', 'Chandni', 'Dipu'];

// Seat-relative aims; the seat comes from whoever's turn it is.
const SCRIPT: Omit<ShotInput, 'seat'>[] = [
  { x: 0, dirX: 0, dirY: 1, power: 1 },
  { x: 0.1, dirX: 0.3, dirY: 0.95, power: 0.6 },
  { x: -0.2, dirX: -0.5, dirY: 0.8, power: 0.8 },
  { x: 0.25, dirX: 0.1, dirY: 1, power: 0.4 },
  { x: 0, dirX: -0.2, dirY: 1, power: 0.9 },
  { x: -0.1, dirX: 0.7, dirY: 0.7, power: 0.5 },
];

describe('localGame', () => {
  it('LOC-2 a scripted run through the controller equals simulateShot + applyShot', () => {
    let g = startLocal(CFG, NAMES, true);
    let direct = newGame(CFG);
    expect(g.state).toEqual(direct);
    for (const s of SCRIPT) {
      const input: ShotInput = { ...s, seat: g.state.turnSeat as Seat };
      const before = g.state.board;
      const out = shootLocal(g, input);
      const sim = simulateShot(direct.board, { ...s, seat: direct.turnSeat as Seat });
      const ref = applyShot(direct, sim.events, sim.final);
      expect(out.game.state).toEqual(ref.state);
      expect(out.ruleEvents).toEqual(ref.events);
      expect(out.shot).toEqual({ start: before, input });
      g = out.game;
      direct = ref.state;
    }
    expect(g.names).toEqual(NAMES);
  });

  it('LOC-2 timeoutLocal equals applyTimeout', () => {
    const g = startLocal(CFG, NAMES, true);
    const out = timeoutLocal(g);
    const ref = applyTimeout(g.state);
    expect(out.game.state).toEqual(ref.state);
    expect(out.ruleEvents).toEqual(ref.events);
  });

  it('LOC-2 seatName maps players to seats', () => {
    const two = startLocal({ ...CFG, format: '1v1' }, ['Asha', 'Bilu'], false);
    expect(seatName(two, 0)).toBe('Asha');
    expect(seatName(two, 2)).toBe('Bilu');
    expect(seatName(two, 1)).toBe('');
    const four = startLocal(CFG, NAMES, false);
    expect([0, 1, 2, 3].map((s) => seatName(four, s))).toEqual(NAMES);
  });
});
