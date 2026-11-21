import type { LobbyView, PlayerView, ServerMessage } from '@carrom/protocol';
import { callbreakView, newCallbreak } from '@hub/callbreak';
import { describe, expect, it } from 'vitest';
import { advance, canAct, catchUp, cbConfigOf, isBotSeat, namesOf, nextChange } from './online';

const player = (seat: number, over: Partial<PlayerView> = {}): PlayerView => ({
  sessionId: `s${seat}`, userId: `u${seat}`, name: `P${seat}`, avatar: 0, seat, ready: true, bot: false, left: false, rematch: false,
  striker: '', coinSet: '', voiceOn: false, voiceMuted: true, ...over,
});

describe('callbreak online screen', () => {
  it('CB-8 changes play in turnId order from the latest game view; you act only when all is shown', () => {
    const s = newCallbreak({ rounds: 3, redeal: true }, 1);
    const v = callbreakView(s, 0);
    const change = (turnId: number): ServerMessage => ({ type: 'moveResult', turnId, seat: 0, move: { bid: 1 }, events: [], hash: '', view: { ...v, turnId: turnId + 1 }, durationMs: 0 });
    let o = catchUp(null, [{ type: 'game', view: v, turnId: 0 }, change(1), change(0)])!;
    expect(o.queue.map((q) => q.turnId)).toEqual([0, 1]);
    expect(nextChange(o)?.turnId).toBe(0);
    o = advance(advance(o, 0), 1);
    expect([o.turnId, o.queue.length]).toEqual([2, 0]);
    expect(canAct({ ...o, shown: { ...o.shown, turnSeat: 0 } }, 0, false)).toBe(true);
    expect(canAct({ ...o, shown: { ...o.shown, turnSeat: 0 } }, 0, true)).toBe(false);
    expect(canAct({ ...o, shown: { ...o.shown, turnSeat: 1 } }, 0, false)).toBe(false);
  });

  it('CB-8 seats the host gave to bots get a bot name; a broken config reads as the defaults', () => {
    const lobby: LobbyView = {
      code: 'ABC', phase: 'playing', gameId: 'callbreak', config: '{"rounds":3,"redeal":false}', hostId: 's0', ranked: false,
      players: { s0: player(0), b1: player(1, { userId: '', name: '', bot: true, left: true }), s2: player(2, { bot: true }) },
    };
    expect(isBotSeat(lobby.players.b1)).toBe(true);
    expect(isBotSeat(lobby.players.s2)).toBe(false); // a person whose seat the bot took over
    expect(namesOf(lobby, (s) => `Bot ${s + 1}`)).toEqual(['P0', 'Bot 2', 'P2', 'Bot 4']);
    expect(cbConfigOf(lobby)).toEqual({ rounds: 3, redeal: false });
    expect(cbConfigOf({ config: 'nope' })).toEqual({ rounds: 5, redeal: true });
  });
});
