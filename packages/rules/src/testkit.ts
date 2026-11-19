// Test helpers: build hand-made shot results, no physics needed.
import type { ShotEvent } from '@carrom/engine';
import { applyShot, newGame } from './game';
import { firstBreakSeat } from './turns';
import type { Format, GameState, Length, Preset, RuleEvent } from './types';

export const W = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9'];
export const B = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'];

export function seedFor(format: Format, seat: number): number {
  for (let seed = 0; seed < 1000; seed++) if (firstBreakSeat(seed, format) === seat) return seed;
  throw new Error(`no seed breaks at seat ${seat}`);
}

export function game(
  preset: Preset, format: Format = '1v1', length: Length = { kind: 'board' }, breakSeat = 0,
): GameState {
  return newGame({ preset, format, length, seed: seedFor(format, breakSeat) });
}

/** The engine reported these coins dropping, in this order. */
export function shoot(g: GameState, ids: string[]): { state: GameState; events: RuleEvent[] } {
  const final = {
    pieces: g.board.pieces.map((p) => (ids.includes(p.id) ? { ...p, pocketed: true } : { ...p })),
  };
  const events: ShotEvent[] = ids.map((id, i) => ({ t: i, type: 'pocket', id, pocket: 0 }));
  return applyShot(g, events, final);
}

/** Several shots in a row; returns the last state and all rule events. */
export function play(g: GameState, shots: string[][]): { state: GameState; events: RuleEvent[] } {
  let state = g;
  const events: RuleEvent[] = [];
  for (const ids of shots) {
    const out = shoot(state, ids);
    state = out.state;
    events.push(...out.events);
  }
  return { state, events };
}
