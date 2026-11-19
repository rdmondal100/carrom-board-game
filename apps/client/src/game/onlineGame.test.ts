import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import type { LobbyView, ServerMessage } from '@carrom/protocol';
import { applyShot, applyTimeout, newGame, type GameState } from '@carrom/rules';
import { describe, expect, it } from 'vitest';
import {
  advance, animate, asLocalGame, canShoot, catchUp, dropOwnShot, fromLog, hashMatches, nextStep, receive,
  type Online, type ShotResult,
} from './onlineGame';

const g0 = newGame({ format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 3 });

function shot(state: GameState, turnId: number, over: Partial<ShotInput> = {}): ShotResult {
  const input: ShotInput = { seat: state.turnSeat as ShotInput['seat'], x: 0, dirX: 0, dirY: 1, power: 0.6, ...over };
  const sim = simulateShot(state.board, input);
  const out = applyShot(state, sim.events, sim.final);
  return {
    type: 'shotResult', turnId, seat: state.turnSeat, input, ruleEvents: out.events,
    stateHash: stateHash(out.state.board), state: out.state, durationMs: sim.durationMs,
  };
}

const start = (): Online => receive(null, { type: 'game', state: g0, turnId: 0 })!;

describe('online game', () => {
  it('ROOM-5 a replay checks the hash; the right input matches, another does not', () => {
    const r = shot(g0, 0);
    expect(hashMatches(g0, r)).toBe(true);
    expect(hashMatches(g0, { ...r, input: { ...r.input, power: 0.61 } })).toBe(false);
  });

  it('ROOM-5 a remote shot is replayed, then its server state is shown', () => {
    const r = shot(g0, 0);
    let o = receive(start(), r)!;
    expect(nextStep(o, false)).toEqual({ kind: 'replay', msg: r });
    o = animate(o, 0);
    expect(nextStep(o, true)).toEqual({ kind: 'idle' });
    expect(nextStep(o, false)).toEqual({ kind: 'finish', msg: r });
    o = advance(o, 0);
    expect(advance(o, 0)).toBe(o);
    expect(o.shown).toBe(r.state);
    expect(o.turnId).toBe(1);
    expect(o.animating).toBeNull();
  });

  it('ROOM-5 own shot: animates first, finishes when the result arrives', () => {
    let o = animate(start(), 0);
    expect(nextStep(o, false)).toEqual({ kind: 'idle' });
    const r = shot(g0, 0);
    o = receive(o, r)!;
    expect(nextStep(o, true)).toEqual({ kind: 'idle' });
    expect(nextStep(o, false)).toEqual({ kind: 'finish', msg: r });
  });

  it('ROOM-4 a refused own shot is dropped and the screen keeps the old state', () => {
    const o = dropOwnShot(animate(start(), 0));
    expect(o.animating).toBeNull();
    expect(o.shown).toBe(g0);
    expect(canShoot(o, g0.turnSeat, false)).toBe(true);
  });

  it('ROOM-7 results show in turnId order; timeouts need no animation; old ones are ignored', () => {
    const r0 = shot(g0, 0);
    const t = applyTimeout(r0.state);
    const t1: ServerMessage = { type: 'timeout', turnId: 1, seat: r0.state.turnSeat, ruleEvents: t.events, state: t.state };
    let o = receive(receive(start(), t1), r0)!;
    expect(o.queue.map((q) => q.turnId)).toEqual([0, 1]);
    o = advance(animate(o, 0), 0);
    expect(nextStep(o, false)).toEqual({ kind: 'timeout', msg: t1 });
    o = advance(o, 1);
    expect(o.turnId).toBe(2);
    expect(receive(o, r0)).toBe(o);
  });

  it('ROOM-8 a game message (rejoin, rematch) replaces everything; fromLog rebuilds the screen', () => {
    const r = shot(g0, 0);
    const o = fromLog([{ type: 'game', state: g0, turnId: 0 }, r, { type: 'clock', turnId: 1, ms: 5 }])!;
    expect(o.queue).toEqual([r]);
    expect(receive(o, { type: 'game', state: r.state, turnId: 1 })).toEqual({ shown: r.state, turnId: 1, queue: [], animating: null, origin: r.state });
    expect(fromLog([r])).toBeNull();
  });

  it('ROOM-5 catchUp picks up missed messages without losing an animation; a new game starts over', () => {
    const game: ServerMessage = { type: 'game', state: g0, turnId: 0 };
    const r = shot(g0, 0);
    const o = animate(fromLog([game])!, 0);
    const caught = catchUp(o, [game, r])!;
    expect(caught.queue).toEqual([r]);
    expect(caught.animating).toBe(0);
    expect(catchUp(caught, [game, r])).toEqual(caught);
    const rematch: ServerMessage = { type: 'game', state: r.state, turnId: 0 };
    expect(catchUp(caught, [rematch])!.shown).toBe(r.state);
    expect(catchUp(null, [game])!.shown).toBe(g0);
  });

  it('only the seat to move may shoot, and only when nothing is pending', () => {
    const o = start();
    const other = g0.turnSeat === 0 ? 2 : 0;
    expect(canShoot(o, other, false)).toBe(false);
    expect(canShoot(o, g0.turnSeat, true)).toBe(false);
    expect(canShoot(receive(o, shot(g0, 0))!, g0.turnSeat, false)).toBe(false);
    expect(canShoot(o, null, false)).toBe(false);
  });

  it('asLocalGame names seats in seat order and marks bot seats as taken over', () => {
    const p = (seat: number, name: string, bot = false) =>
      ({ sessionId: name, userId: name, name, avatar: 0, seat, ready: true, bot, left: false, rematch: false });
    const lobby: LobbyView = {
      code: 'ABCDEF', phase: 'playing', format: '1v1', preset: 'colour', lengthKind: 'board', target: 0,
      hostId: 'x', players: { x: p(2, 'Rina', true), y: p(0, 'Sami') },
    };
    const g = asLocalGame(g0, lobby);
    expect(g.names).toEqual(['Sami', 'Rina']);
    expect(g.takeover).toEqual([2]);
  });
});
