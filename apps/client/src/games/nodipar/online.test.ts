import type { ServerMessage } from '@carrom/protocol';
import { DEFAULT_NODI_CONFIG, nodiParModule as m, type NodiState } from '@hub/nodipar';
import { describe, expect, it } from 'vitest';
import { advance, canAct, catchUp, nextChange, nodiConfigOf, receive } from './online';

/** A short server log: the game message and the first few results, from the real module. */
function serverLog(n: number): { log: ServerMessage[]; states: NodiState[] } {
  let s = m.newGame(DEFAULT_NODI_CONFIG, 11);
  const log: ServerMessage[] = [{ type: 'game', view: m.view(s, null), turnId: 0 }];
  const states = [s];
  for (let i = 0; i < n; i++) {
    const seat = s.turnSeat;
    const turnId = s.turnId;
    const move = m.bot(s, seat, 'easy', i);
    const out = m.applyMove(s, seat, turnId, move);
    if (!out.ok) throw new Error(out.message);
    s = out.state;
    states.push(s);
    log.push({ type: 'moveResult', turnId, seat, move, events: out.events, hash: m.hash(s), view: m.view(s, null), durationMs: out.durationMs });
  }
  return { log, states };
}

describe('nodi par online screen', () => {
  it('NODI-5 results play in turnId order, whatever order they arrive in; repeats are dropped', () => {
    const { log, states } = serverLog(3);
    let o = receive(null, log[0]!)!;
    o = receive(receive(receive(o, log[3]!), log[1]!), log[2]!)!;
    o = receive(o, log[1]!)!;
    expect(o.queue.map((q) => q.turnId)).toEqual([0, 1, 2]);
    for (let t = 0; t < 3; t++) {
      const c = nextChange(o)!;
      expect(c.turnId).toBe(t);
      o = advance(o, t);
    }
    expect(o.shown).toEqual(states[3]);
    expect(catchUp(null, log)?.queue).toHaveLength(3);
  });

  it('NODI-5 the player may act only on their own settled turn; a broken room config reads as the defaults', () => {
    const { log } = serverLog(0);
    const o = receive(null, log[0]!)!;
    const seat = o.shown.turnSeat;
    expect(canAct(o, seat, false)).toBe(true);
    expect(canAct(o, seat, true)).toBe(false);
    expect(canAct(o, seat === 0 ? 2 : 0, false)).toBe(false);
    expect(canAct({ ...o, sent: 0 }, seat, false)).toBe(false);
    expect(nodiConfigOf({ config: JSON.stringify({ players: 4, borsha: true }) })).toEqual({ players: 4, borsha: true });
    expect(nodiConfigOf({ config: 'nope' })).toEqual(DEFAULT_NODI_CONFIG);
  });
});
