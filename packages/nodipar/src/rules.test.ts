import { NODI, TABLES, type Piece } from '@carrom/engine';
import { describe, expect, it } from 'vitest';
import { LAYOUTS, NODI_ANIM, NODI_RULES } from './config';
import { boatId, emptyRiver, ownersOf, parChain, standing, tableOf } from './islands';
import { applyNodiMove, inHand, launchPoint, matchWinner, newNodi, nodiTimeout, onRiver, TURNS } from './rules';
import type { NodiConfig, NodiState, RoundResult, Team } from './types';

const ONE: NodiConfig = { players: 2, borsha: false };
const TWO: NodiConfig = { players: 4, borsha: false };
const RIVER = LAYOUTS[2];

/** A state whose boats sit at these spots ([seat, boat, x, y]); the rest stay in hand. */
function withBoats(c: NodiConfig, spots: [number, number, number, number][], turnSeat = 0): NodiState {
  const s = newNodi(c, 1, turnSeat);
  const pieces = s.board.pieces.map((p): Piece => {
    const at = spots.find(([seat, k]) => boatId(seat, k) === p.id);
    return at ? { ...p, x: at[2], y: at[3], pocketed: false } : p;
  });
  const board = { pieces };
  return { ...s, board, ...standing(board, c) };
}

/** Moor a boat of `seat` on island i (its centre, or just beside a centre rock). */
const on = (c: NodiConfig, seat: number, k: number, i: number, dx = 0): [number, number, number, number] => {
  const isl = LAYOUTS[c.players].islands[i]!;
  const big = isl.points === NODI_RULES.CENTRE_POINTS;
  return [seat, k, isl.x + (big ? 0.07 : dx), isl.y];
};

describe('NODI-2 mooring and ownership', () => {
  it('NODI-2 a boat whose centre is inside a ring is moored; the side with more boats owns the island', () => {
    const s = withBoats(ONE, [on(ONE, 0, 0, 0), on(ONE, 0, 1, 1), on(ONE, 2, 0, 1, 0.03)]);
    const owners = ownersOf(s.board, ONE);
    expect(owners[0]).toBe('A');
    expect(owners[1]).toBeNull(); // one each: a tie belongs to nobody
    expect(owners.slice(2)).toEqual([null, null, null, null, null]);
    const two = withBoats(ONE, [on(ONE, 2, 0, 1), on(ONE, 2, 1, 1, 0.02), on(ONE, 0, 0, 1, -0.02)]);
    expect(ownersOf(two.board, ONE)[1]).toBe('B');
  });

  it('NODI-2 a boat just outside the ring is not moored', () => {
    const isl = RIVER.islands[0]!;
    const s = withBoats(ONE, [[0, 0, isl.x + isl.r + 1e-6, isl.y]]);
    expect(ownersOf(s.board, ONE)[0]).toBeNull();
  });

  it('NODI-2 a launch moors a boat and scores the island; a refused move changes nothing', () => {
    const s = newNodi(ONE, 1, 0);
    const isl = RIVER.islands[0]!; // top-left, seat 0's own side
    const from = launchPoint(0, 0);
    expect(from).toEqual({ x: 0, y: 0.5 - NODI.BANK_INSET });
    // Seat 0 faces -y; its right is -x. Aim from the bank spot under the island straight at it.
    const x = -isl.x;
    const start = launchPoint(0, x);
    const d = start.y - isl.y;
    let best: NodiState | null = null;
    for (let p = 0.1; p < 0.4 && !best; p += 0.002) {
      const out = applyNodiMove(s, 0, 0, { kind: 'launch', x, dirX: 0, dirY: 1, power: p });
      if (out.ok && out.state.owners[0] === 'A') best = out.state;
    }
    expect(d).toBeGreaterThan(0);
    expect(best).not.toBeNull();
    expect(best!.live.A).toBe(1);
    expect(onRiver(best!, 0)).toEqual([0]);
    expect(inHand(best!, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(applyNodiMove(s, 2, 0, { kind: 'launch', x: 0, dirX: 0, dirY: 1, power: 0.3 })).toMatchObject({ code: 'NOT_YOUR_TURN' });
    expect(applyNodiMove(s, 0, 3, { kind: 'launch', x: 0, dirX: 0, dirY: 1, power: 0.3 })).toMatchObject({ code: 'STALE_TURN' });
    expect(applyNodiMove(s, 0, 0, { kind: 'launch', x: 0.9, dirX: 0, dirY: 1, power: 0.3 })).toMatchObject({ code: 'BAD_MOVE' });
    expect(applyNodiMove(s, 0, 0, { kind: 'flick', boat: 0, dirX: 0, dirY: 1, power: 0.3 })).toMatchObject({ code: 'BAD_MOVE' });
    expect(s.board).toEqual(newNodi(ONE, 1, 0).board);
  });

  it('NODI-2 a boat flicked into a whirlpool returns to its owner\'s bank', () => {
    const w = TABLES.nodiPar.pockets[0]!; // (-0.42, 0)
    // Seat 0's boat sits right of the whirlpool; flick it toward -x (seat 0's right is -x).
    const s = withBoats(ONE, [[0, 3, w.x + 0.12, w.y]]);
    const out = applyNodiMove(s, 0, 0, { kind: 'flick', boat: 3, dirX: 1, dirY: 0, power: 0.4 });
    if (!out.ok) throw new Error(out.message);
    expect(out.events).toContainEqual({ type: 'whirlpool', seat: 0, boat: 3 });
    expect(inHand(out.state, 0)).toContain(3);
    expect(onRiver(out.state, 0)).toEqual([]);
    // ...and can be launched again.
    expect(applyNodiMove(out.state, 2, 1, { kind: 'launch', x: 0, dirX: 0, dirY: 1, power: 0.2 }).ok).toBe(true);
  });
});

describe('NODI-2 par', () => {
  it('NODI-2 par: a chain of own islands from bank to bank, on the fixed graph', () => {
    // Top-left (bank 0) – left (2) – bottom-left (bank 2): a par for A.
    const owners: (Team | null)[] = ['A', null, 'A', null, null, 'A', null];
    expect(parChain(owners, ONE, 'A')).toEqual([0, 2, 5]);
    expect(parChain(owners, ONE, 'B')).toEqual([]);
    // Top-left and bottom-right are not neighbours: no chain without the centre.
    expect(parChain(['A', null, null, null, null, null, 'A'], ONE, 'A')).toEqual([]);
    expect(parChain(['A', null, null, 'A', null, null, 'A'], ONE, 'A')).toEqual([0, 3, 6]);
    // 2v2: B links bank 1 (-x) to bank 3 (+x): west – centre – east.
    expect(parChain([null, 'B', null, 'B', 'B', null, null], TWO, 'B')).toEqual([3, 4, 1]);
    expect(parChain([null, 'B', null, 'B', 'B', null, null], TWO, 'A')).toEqual([]);
    // A's north–centre–south is not a par for B.
    expect(parChain(['B', null, 'B', null, 'B', null, null], TWO, 'B')).toEqual([]);
  });

  it('NODI-2 par detection on a hand-built board: points 1 per island, 3 for the centre, +5 par', () => {
    const s = withBoats(ONE, [on(ONE, 0, 0, 0), on(ONE, 0, 1, 3), on(ONE, 0, 2, 6), on(ONE, 2, 0, 4)]);
    expect(s.owners).toEqual(['A', null, null, 'A', 'B', null, 'A']);
    expect(s.pars.A).toEqual([0, 3, 6]);
    expect(s.pars.B).toEqual([]);
    expect(s.live).toEqual({ A: 1 + 3 + 1 + NODI_RULES.PAR_BONUS, B: 1 });
  });

  it('NODI-2 the layouts are fair and fit: islands clear of whirlpools and rocks, banks mirror', () => {
    for (const c of [ONE, TWO]) {
      const layout = LAYOUTS[c.players];
      const table = tableOf(c);
      for (const isl of layout.islands) {
        for (const w of table.pockets) expect(Math.hypot(isl.x - w.x, isl.y - w.y)).toBeGreaterThan(isl.r + table.pocketD / 2);
        expect(Math.abs(isl.x) + isl.r).toBeLessThan(0.5 - NODI.BANK_INSET);
      }
      expect(emptyRiver(c).pieces).toHaveLength(c.players * NODI_RULES.BOATS);
    }
    // 1v1 mirror y → -y maps bank 0's islands onto bank 2's.
    const mirror = (i: number) => RIVER.islands.findIndex((j) => j.x === RIVER.islands[i]!.x && j.y === -RIVER.islands[i]!.y);
    expect(RIVER.banks[0]!.map(mirror).sort()).toEqual([...RIVER.banks[2]!].sort());
  });
});

describe('NODI-2 rounds and match', () => {
  it(`NODI-2 a round ends after ${TURNS} moves each; the next round clears the river and the other seat starts`, () => {
    let s = withBoats(ONE, [on(ONE, 0, 0, 0), on(ONE, 0, 1, 3)]);
    let events: string[] = [];
    for (let i = 0; i < 2 * TURNS; i++) {
      const out = nodiTimeout({ ...s, timeouts: [0, 0, 0, 0] });
      events = out.events.map((e) => e.type);
      s = out.state;
    }
    expect(events).toContain('roundEnd');
    expect(s.results).toEqual([{ round: 1, points: { A: 4, B: 0 }, winner: 'A' }]);
    expect(s.round).toBe(2);
    expect(s.turnSeat).toBe(2);
    expect(s.board.pieces.every((p) => p.pocketed)).toBe(true);
    expect(s.moves).toEqual([0, 0, 0, 0]);
  });

  it('NODI-2 a round-ending move waits for the score screen', () => {
    const s = { ...withBoats(ONE, []), moves: [TURNS - 1, 0, TURNS, 0] };
    const out = applyNodiMove(s, 0, s.turnId, { kind: 'launch', x: 0.2, dirX: 0, dirY: 1, power: 0.2 });
    if (!out.ok) throw new Error(out.message);
    expect(out.events.at(-1)).toMatchObject({ type: 'roundEnd' });
    expect(out.durationMs).toBeGreaterThanOrEqual(NODI_ANIM.ROUND_END_MS);
  });

  it('NODI-2 match scoring: best of 3, then points, then play on', () => {
    const r = (A: number, B: number): RoundResult => ({ round: 0, points: { A, B }, winner: A > B ? 'A' : B > A ? 'B' : null });
    expect(matchWinner([r(3, 1)], 'A')).toBeNull();
    expect(matchWinner([r(3, 1), r(4, 0)], 'B')).toBe('A');
    expect(matchWinner([r(3, 1), r(0, 4)], 'A')).toBeNull();
    expect(matchWinner([r(3, 1), r(0, 4), r(0, 2)], 'A')).toBe('B');
    expect(matchWinner([r(3, 1), r(2, 2), r(2, 2)], 'B')).toBe('A'); // one win to none
    expect(matchWinner([r(2, 2), r(3, 3), r(1, 1)], 'B')).toBeNull(); // level: play on
    expect(matchWinner([r(2, 2), r(3, 3), r(1, 1), r(0, 0), r(5, 5)], 'B')).toBe('B');
  });

  it('NODI-2 timeouts: the move is lost, the second in a row hands the seat to the bot', () => {
    const s = newNodi(ONE, 4, 0);
    const one = nodiTimeout(s);
    expect(one.events).toEqual([{ type: 'timeout', seat: 0 }]);
    expect(one.state.moves[0]).toBe(1);
    const back = nodiTimeout(one.state); // seat 2's first
    const two = nodiTimeout(back.state);
    expect(two.events).toContainEqual({ type: 'botTakeover', seat: 0 });
  });
});
