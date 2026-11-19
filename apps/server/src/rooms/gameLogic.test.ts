import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import { applyShot, firstBreakSeat, type GameConfig } from '@carrom/rules';
import { describe, expect, it } from 'vitest';
import { newMatch, playShot, rematchOf, seedForBreaker, ShotRejected, timeOut, type Match } from './gameLogic.js';

const cfg: GameConfig = { format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 42 };
const straight = (m: Match): ShotInput =>
  ({ seat: m.state.turnSeat as ShotInput['seat'], x: 0, dirX: 0, dirY: 1, power: 0.8 });

function rejected(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof ShotRejected) return err.code;
    throw err;
  }
  return 'accepted';
}

describe('gameLogic', () => {
  it('ROOM-4 out-of-turn shot is rejected and the match is unchanged', () => {
    const m = newMatch(cfg);
    const before = JSON.stringify(m);
    const other = m.state.turnSeat === 0 ? 2 : 0;
    expect(rejected(() => playShot(m, other, 0, { ...straight(m), seat: other as ShotInput['seat'] }))).toBe('NOT_YOUR_TURN');
    // Right seat, but the input claims another seat.
    expect(rejected(() => playShot(m, m.state.turnSeat, 0, { ...straight(m), seat: other as ShotInput['seat'] }))).toBe('NOT_YOUR_TURN');
    expect(JSON.stringify(m)).toBe(before);
  });

  it('ROOM-4 stale turnId is rejected', () => {
    const m = newMatch(cfg);
    expect(rejected(() => playShot(m, m.state.turnSeat, 1, straight(m)))).toBe('STALE_TURN');
    const next = playShot(m, m.state.turnSeat, 0, straight(m)).match;
    expect(next.turnId).toBe(1);
    expect(rejected(() => playShot(next, next.state.turnSeat, 0, straight(next)))).toBe('STALE_TURN');
  });

  it('ROOM-4 a shot the engine refuses is BAD_SHOT', () => {
    const m = newMatch(cfg);
    // The engine throws RangeError on a zero direction (the schema catches it first in a room).
    expect(rejected(() => playShot(m, m.state.turnSeat, 0, { ...straight(m), dirX: 0, dirY: 0 }))).toBe('BAD_SHOT');
    expect(m.turnId).toBe(0);
  });

  it('ROOM-5 stateHash equals a local simulateShot + applyShot of the same input', () => {
    let m = newMatch(cfg);
    for (let i = 0; i < 5 && m.state.winner === null; i++) {
      const input = { ...straight(m), x: 0.05 * i - 0.1, dirX: 0.1, dirY: Math.sqrt(1 - 0.01) };
      const local = simulateShot(m.state.board, input);
      const applied = applyShot(m.state, local.events, local.final);
      const out = playShot(m, m.state.turnSeat, m.turnId, input);
      expect(out.message.stateHash).toBe(stateHash(applied.state.board));
      expect(out.message.durationMs).toBe(local.durationMs);
      expect(out.message.turnId).toBe(m.turnId);
      m = out.match;
    }
  });

  it('ROOM-7 timeout passes the turn; the second in a row emits botTakeover', () => {
    const m = newMatch({ ...cfg, format: '2v2' });
    const seat = m.state.turnSeat;
    const a = timeOut(m);
    expect(a.message.seat).toBe(seat);
    expect(a.match.state.turnSeat).not.toBe(seat);
    expect(a.match.turnId).toBe(1);
    expect(a.message.ruleEvents.some((e) => e.type === 'botTakeover')).toBe(false);
    // Round the table back to the same seat with timeouts by everyone else.
    let x = a.match;
    while (x.state.turnSeat !== seat) x = timeOut(x).match;
    const b = timeOut(x);
    expect(b.message.ruleEvents).toContainEqual({ type: 'botTakeover', seat });
  });

  it('ROOM-9 rematch starts a new game with the next seat breaking', () => {
    for (const format of ['1v1', '2v2'] as const) {
      const m = newMatch({ ...cfg, format, seed: 7 });
      const r = rematchOf(m);
      const want = format === '1v1' ? (m.firstBreak === 0 ? 2 : 0) : (m.firstBreak + 1) % 4;
      expect(r.firstBreak).toBe(want);
      expect(r.state.turnSeat).toBe(want);
      expect(r.turnId).toBe(0);
      expect(r.state.scores).toEqual({ A: 0, B: 0 });
    }
  });

  it('ROOM-9 seedForBreaker finds a seed for every seat', () => {
    for (const seat of [0, 1, 2, 3]) expect(firstBreakSeat(seedForBreaker(100, seat, '2v2'), '2v2')).toBe(seat);
  });
});
