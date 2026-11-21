import type { LobbyView, ServerMessage } from '@carrom/protocol';
import { DEFAULT_LUDO_CONFIG, ludoModule, ludoView, type LudoState } from '@hub/ludo';
import { describe, expect, it } from 'vitest';
import { advance, canAct, catchUp, ludoConfigOf, nextChange, receive } from './online';

/** A short server log: the game message and the first few results, from the real module. */
function serverLog(n: number): { log: ServerMessage[]; states: LudoState[] } {
  let s = ludoModule.newGame(DEFAULT_LUDO_CONFIG, 11);
  const log: ServerMessage[] = [{ type: 'game', view: ludoView(s), turnId: 0 }];
  const states = [s];
  for (let i = 0; i < n; i++) {
    const seat = s.turnSeat;
    const turnId = s.turnId;
    const move = ludoModule.bot(s, seat, 'medium', i);
    const out = ludoModule.applyMove(s, seat, turnId, move);
    if (!out.ok) throw new Error(out.message);
    s = out.state;
    states.push(s);
    log.push({ type: 'moveResult', turnId, seat, move, events: out.events, hash: ludoModule.hash(s), view: ludoView(s), durationMs: out.durationMs });
  }
  return { log, states };
}

describe('ludo online screen', () => {
  it('LUDO-7 results play in turnId order, whatever order they arrive in; repeats are dropped', () => {
    const { log, states } = serverLog(3);
    let o = receive(null, log[0]!)!;
    o = receive(receive(receive(o, log[3]!), log[1]!), log[2]!)!;
    o = receive(o, log[1]!)!;
    expect(o.queue.map((q) => q.turnId)).toEqual([0, 1, 2]);
    for (let i = 0; i < 3; i++) {
      const c = nextChange(o)!;
      expect(c.turnId).toBe(i);
      o = advance(o, c.turnId);
    }
    expect(o.shown.tokens).toEqual(states[3]!.tokens);
    expect(nextChange(o)).toBeNull();
  });

  it('LUDO-7 catchUp is idempotent and a new game message starts over', () => {
    const { log } = serverLog(2);
    const once = catchUp(null, log);
    expect(catchUp(once, log)).toEqual(once);
    const fresh = ludoModule.newGame(DEFAULT_LUDO_CONFIG, 99);
    const next = catchUp(once, [{ type: 'game', view: ludoView(fresh), turnId: 0 }]);
    expect(next?.queue).toEqual([]);
    expect(next?.shown.tokens).toEqual(fresh.tokens);
  });

  it('LUDO-7 only the seat on turn may act, once, with nothing waiting', () => {
    const { log } = serverLog(1);
    const o = receive(null, log[0]!)!;
    const seat = o.shown.turnSeat;
    expect(canAct(o, seat, false)).toBe(true);
    expect(canAct(o, (seat + 2) % 4, false)).toBe(false);
    expect(canAct(o, seat, true)).toBe(false);
    expect(canAct({ ...o, sent: 0 }, seat, false)).toBe(false);
    expect(canAct(receive(o, log[1]!)!, seat, false)).toBe(false);
  });

  it('LUDO-7 room settings come from the lobby; a broken value reads as the defaults', () => {
    const lobby = (config: string) => ({ config }) as Pick<LobbyView, 'config'>;
    expect(ludoConfigOf(lobby(JSON.stringify({ ...DEFAULT_LUDO_CONFIG, players: 4, teams: true })))).toMatchObject({ teams: true });
    expect(ludoConfigOf(lobby('{nope'))).toEqual(DEFAULT_LUDO_CONFIG);
  });
});
