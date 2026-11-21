import { nextInt } from '@hub/game-kit';
import { describe, expect, it } from 'vitest';
import { legalTokens, squareOf } from './board';
import { LUDO } from './config';
import { DEFAULT_LUDO_CONFIG, ludoModule } from './module';
import { applyLudoMove, ludoResult, newLudo, roll } from './rules';
import type { LudoConfig, LudoEvent, LudoState } from './types';

const Y = LUDO.YARD;
const H = LUDO.HOME;

/** A game with these tokens, `seat` on turn with `dice` rolled. */
function setup(over: Partial<LudoConfig>, tokens: Record<number, number[]>, seat = 0, dice: number | null = null): LudoState {
  const config = { ...DEFAULT_LUDO_CONFIG, ...over };
  const s = newLudo(config, 1);
  const all = s.tokens.map((l, i) => tokens[i] ?? l);
  return { ...s, tokens: all, turnSeat: seat, phase: dice === null ? 'roll' : 'move', dice, sixes: 0, turnId: 0 };
}

/** Track progress of `seat` that sits on shared square `square`. */
const at = (seat: number, square: number): number => (square - seat * LUDO.QUARTER + LUDO.TRACK) % LUDO.TRACK;

/** A seed whose first die is `face` (1..6). */
function seedRolling(face: number, from = 0): number {
  for (let s = from; ; s++) if (nextInt({ seed: s }, LUDO.DIE_SIDES)[0] === face - 1) return s;
}

function play(s: LudoState, token: number): { state: LudoState; events: LudoEvent[] } {
  const out = applyLudoMove(s, s.turnSeat, s.turnId, { token });
  if (!out.ok) throw new Error(out.message);
  return out;
}

describe('ludo rules', () => {
  it.each(['classic', 'bd'] as const)('LUDO-1 %s: a token leaves the yard only on a 6, and the 6 rolls again', (preset) => {
    const yard = setup({ preset }, { 0: [Y, Y, Y, Y] }, 0, 5);
    expect(legalTokens(yard, 0, 5)).toEqual([]);
    const six = setup({ preset, tapToRoll: true }, { 0: [Y, Y, Y, Y] }, 0, 6);
    expect(legalTokens(six, 0, 6)).toEqual([0, 1, 2, 3]);
    const { state } = play(six, 2);
    expect(state.tokens[0]).toEqual([Y, Y, 0, Y]);
    expect(state.turnSeat).toBe(0);
    expect(state.phase).toBe('roll');
  });

  it('LUDO-1 a capture sends the token back to its yard and rolls again', () => {
    const s = setup({ tapToRoll: true }, { 0: [3, Y, Y, Y], 2: [at(2, 5), Y, Y, Y] }, 0, 2);
    const { state, events } = play(s, 0);
    expect(state.tokens[0]![0]).toBe(5);
    expect(state.tokens[2]![0]).toBe(Y);
    expect(events).toContainEqual({ type: 'capture', seat: 0, victim: 2, token: 0, from: at(2, 5) });
    expect(state.turnSeat).toBe(0);
  });

  it('LUDO-1 safe squares (starts and stars) can\'t be captured', () => {
    const star = 8;
    const s = setup({ tapToRoll: true }, { 0: [5, Y, Y, Y], 2: [at(2, star), Y, Y, Y] }, 0, 3);
    const { state, events } = play(s, 0);
    expect(squareOf(0, state.tokens[0]![0]!)).toBe(star);
    expect(state.tokens[2]![0]).toBe(at(2, star));
    expect(events.some((e) => e.type === 'capture')).toBe(false);
    expect(state.turnSeat).toBe(2);
  });

  it('LUDO-1 bd needs the exact roll to finish; classic lets an overshoot finish', () => {
    expect(legalTokens(setup({ preset: 'bd' }, { 0: [54, Y, Y, Y] }), 0, 3)).toEqual([]);
    expect(legalTokens(setup({ preset: 'bd' }, { 0: [54, Y, Y, Y] }), 0, 2)).toEqual([0]);
    const classic = setup({ preset: 'classic', tapToRoll: true }, { 0: [54, Y, Y, Y] }, 0, 3);
    const { state, events } = play(classic, 0);
    expect(state.tokens[0]![0]).toBe(H);
    expect(events).toContainEqual({ type: 'home', seat: 0, token: 0 });
    expect(state.turnSeat).toBe(0); // reaching home rolls again
  });

  it('LUDO-1 three 6s in a row lose the turn', () => {
    const s = { ...setup({ tapToRoll: true }, { 0: [10, Y, Y, Y] }), sixes: 2, rng: { seed: seedRolling(6) } };
    const events: LudoEvent[] = [];
    const after = roll(s, events);
    expect(events).toEqual([{ type: 'roll', seat: 0, value: 6 }, { type: 'pass', seat: 0, reason: 'threeSixes' }]);
    expect(after.turnSeat).toBe(2);
    expect(after.tokens[0]).toEqual([10, Y, Y, Y]);
  });

  it('LUDO-2 classic blockades stop passing on any square; bd only on safe squares (and bd captures the pair)', () => {
    const pair = at(2, 10);
    const tokens = { 0: [7, Y, Y, Y], 2: [pair, pair, Y, Y] };
    expect(legalTokens(setup({ preset: 'classic' }, tokens), 0, 5)).toEqual([]);
    expect(legalTokens(setup({ preset: 'bd' }, tokens), 0, 5)).toEqual([0]);
    const { state } = play(setup({ preset: 'bd', tapToRoll: true }, tokens, 0, 3), 0);
    expect(state.tokens[2]).toEqual([Y, Y, Y, Y]);
    const safePair = at(2, 8);
    expect(legalTokens(setup({ preset: 'bd' }, { 0: [5, Y, Y, Y], 2: [safePair, safePair, Y, Y] }), 0, 4)).toEqual([]);
  });

  it('LUDO-3 no legal move passes the turn', () => {
    const s = { ...setup({ tapToRoll: true }, { 0: [Y, Y, Y, Y] }), rng: { seed: seedRolling(4) } };
    const out = applyLudoMove(s, 0, 0, { roll: true });
    if (!out.ok) throw new Error(out.message);
    expect(out.events).toEqual([{ type: 'roll', seat: 0, value: 4 }, { type: 'pass', seat: 0, reason: 'noMove' }]);
    expect(out.state.turnSeat).toBe(2);
    expect(out.state.turnId).toBe(1);
  });

  it('LUDO-3 auto roll: the server rolls each turn and skips seats with no move', () => {
    const s = newLudo(DEFAULT_LUDO_CONFIG, 5);
    expect(s.phase).toBe('move');
    expect(s.dice).toBe(LUDO.SIX);
    expect(s.recent.filter((e) => e.type === 'roll').at(-1)).toEqual({ type: 'roll', seat: s.turnSeat, value: 6 });
    expect(s.recent.filter((e) => e.type === 'pass').every((e) => e.type === 'pass' && e.reason === 'noMove')).toBe(true);
  });

  it('LUDO-3 refused moves change nothing and say why', () => {
    const s = setup({}, { 0: [Y, Y, Y, Y] }, 0, 6);
    const copy = JSON.stringify(s);
    expect(applyLudoMove(s, 2, 0, { token: 0 })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(applyLudoMove(s, 0, 3, { token: 0 })).toMatchObject({ ok: false, code: 'STALE_TURN' });
    expect(applyLudoMove(s, 0, 0, { roll: true })).toMatchObject({ ok: false, code: 'BAD_MOVE' });
    expect(applyLudoMove({ ...s, dice: 5 }, 0, 0, { token: 0 })).toMatchObject({ ok: false, code: 'BAD_MOVE' });
    expect(applyLudoMove({ ...s, winner: '0' }, 0, 0, { token: 0 })).toMatchObject({ ok: false, code: 'GAME_OVER' });
    expect(JSON.stringify(s)).toBe(copy);
  });

  it('LUDO-2 quick mode: one token home wins; placings by progress', () => {
    const s = setup({ quick: true, players: 3 }, { 0: [53, Y, Y, Y], 1: [20, 3, Y, Y], 2: [Y, Y, Y, Y] }, 0, 3);
    const { state, events } = play(s, 0);
    expect(state.winner).toBe('0');
    expect(events.at(-1)).toEqual({ type: 'win', winner: '0' });
    expect(ludoResult(state)).toEqual({ winner: '0', placings: [1, 2, 3] });
  });
});

describe('ludo 2v2', () => {
  const teams = { players: 4, teams: true, tapToRoll: true } as const;

  it('LUDO-2 partners\' tokens don\'t capture each other; opponents\' do', () => {
    const partner = setup(teams, { 0: [3, Y, Y, Y], 2: [at(2, 5), Y, Y, Y] }, 0, 2);
    expect(play(partner, 0).state.tokens[2]![0]).toBe(at(2, 5));
    const opp = setup(teams, { 0: [3, Y, Y, Y], 1: [at(1, 5), Y, Y, Y] }, 0, 2);
    expect(play(opp, 0).state.tokens[1]![0]).toBe(Y);
    expect(ludoModule.teamOf(teams as unknown as LudoConfig, 2)).toBe('A');
  });

  it('LUDO-2 the team wins when both partners are home; a finished partner is skipped', () => {
    const half = setup(teams, { 0: [H, H, H, 54], 2: [H, H, H, 50] }, 0, 2);
    const one = play(half, 3).state;
    expect(one.winner).toBeNull();
    expect(one.turnSeat).toBe(1); // seat 0 is done, so its extra roll goes to the next seat
    const both = setup(teams, { 0: [H, H, H, H], 2: [H, H, H, 55], 1: [10, Y, Y, Y], 3: [Y, Y, Y, Y] }, 2, 1);
    const end = play(both, 3).state;
    expect(end.winner).toBe('A');
    expect(ludoResult(end)?.placings).toEqual([1, 2, 1, 2]);
    expect(ludoModule.configSchema.safeParse({ ...DEFAULT_LUDO_CONFIG, teams: true, players: 2 }).success).toBe(false);
  });
});
