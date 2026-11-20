import { describe, expect, it } from 'vitest';
import { nextFloat, nextInt, shuffle } from './rng';
import { hiddenToyGame, toyGame, type ToyState } from './testkit';

const cfg = { hidden: false };

/** Play the toy to the end with its own bot; returns every state. */
function playOut(seed: number): ToyState[] {
  const states = [toyGame.newGame(cfg, seed)];
  for (let i = 0; i < 9 && !toyGame.result(states.at(-1)!); i++) {
    const s = states.at(-1)!;
    const seat = toyGame.turnSeat(s);
    const out = toyGame.applyMove(s, seat, toyGame.turnId(s), toyGame.bot(s, seat, 'easy', 1));
    if (!out.ok) throw new Error(out.message);
    states.push(out.state);
  }
  return states;
}

describe('game-kit contract', () => {
  it('HUB-1 a toy game runs to its end through the contract', () => {
    const states = playOut(7);
    const last = states.at(-1)!;
    expect(toyGame.result(last)).not.toBeNull();
    expect(toyGame.turnId(last)).toBe(states.length - 1);
    expect(toyGame.configSchema.safeParse({ hidden: true }).success).toBe(true);
    expect(toyGame.moveSchema.safeParse({ cell: 9 }).success).toBe(false);
  });

  it('HUB-1 refused moves change nothing and say why', () => {
    const s = toyGame.newGame(cfg, 3);
    const seat = toyGame.turnSeat(s);
    expect(toyGame.applyMove(s, 1 - seat, 0, { cell: 0 })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(toyGame.applyMove(s, seat, 5, { cell: 0 })).toMatchObject({ ok: false, code: 'STALE_TURN' });
    const one = toyGame.applyMove(s, seat, 0, { cell: 4 });
    if (!one.ok) throw new Error('first move refused');
    expect(toyGame.applyMove(one.state, 1 - seat, 1, { cell: 4 })).toMatchObject({ ok: false, code: 'BAD_MOVE' });
    expect(s.cells.every((c) => c === -1)).toBe(true);
  });

  it('HUB-1 timeout moves for the seat on turn; rematch starts with the other seat', () => {
    const s = toyGame.newGame(cfg, 11);
    const t = toyGame.timeout(s);
    expect(t.seat).toBe(s.turnSeat);
    expect(toyGame.turnId(t.state)).toBe(1);
    expect(toyGame.rematch(s).first).toBe(1 - s.first);
  });

  it('HUB-2 same seed → same game; different seeds → different first players or secrets', () => {
    expect(playOut(42).map(toyGame.hash)).toEqual(playOut(42).map(toyGame.hash));
    const starts = new Set(Array.from({ length: 20 }, (_, i) => {
      const s = toyGame.newGame(cfg, i);
      return `${s.first}:${s.secrets.join(',')}`;
    }));
    expect(starts.size).toBeGreaterThan(10);
    expect(new Set(Array.from({ length: 50 }, (_, i) => toyGame.newGame(cfg, i).first))).toEqual(new Set([0, 1]));
  });

  it('HUB-2 rng: floats in [0, 1), ints in range, shuffle keeps every item', () => {
    let rng = { seed: 9 };
    for (let i = 0; i < 1000; i++) {
      let u: number, n: number;
      [u, rng] = nextFloat(rng);
      [n, rng] = nextInt(rng, 6);
      expect(u >= 0 && u < 1).toBe(true);
      expect(Number.isInteger(n) && n >= 0 && n < 6).toBe(true);
    }
    const [deck] = shuffle([...Array(52).keys()], { seed: 5 });
    expect([...deck].sort((a, b) => a - b)).toEqual([...Array(52).keys()]);
    expect(shuffle([...Array(52).keys()], { seed: 5 })[0]).toEqual(deck);
  });

  it('HUB-5 hidden views: a seat sees only its own secret; a spectator sees none', () => {
    const s = hiddenToyGame.newGame({ hidden: true }, 1);
    expect(hiddenToyGame.view(s, 0).secrets).toEqual([s.secrets[0], null]);
    expect(hiddenToyGame.view(s, 1).secrets).toEqual([null, s.secrets[1]]);
    expect(hiddenToyGame.view(s, null).secrets).toEqual([null, null]);
    expect(toyGame.view(toyGame.newGame(cfg, 1), null).secrets).not.toContain(null);
  });
});
