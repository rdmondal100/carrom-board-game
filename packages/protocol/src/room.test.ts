import { describe, expect, it } from 'vitest';
import { CarromRoomConfigSchema, CreateRoomOptionsSchema, EMOTES, INVITE_ALPHABET, lobbyConfig } from './room';
import { parseClientMessage, parseServerMessage } from './schemas';

const input = { seat: 0, x: 0, dirX: 0, dirY: 1, power: 0.5 };

describe('room protocol', () => {
  it('ROOM-10 there are exactly 8 emotes and only they parse', () => {
    expect(EMOTES).toHaveLength(8);
    for (const id of EMOTES) expect(parseClientMessage({ type: 'emote', id })).not.toBeNull();
    expect(parseClientMessage({ type: 'emote', id: 'hello there' })).toBeNull();
  });

  it('ROOM-1 invite alphabet has no 0, O, 1 or I', () => {
    for (const c of '0O1I') expect(INVITE_ALPHABET).not.toContain(c);
    expect(new Set(INVITE_ALPHABET).size).toBe(INVITE_ALPHABET.length);
  });

  it('ROOM-1 carrom room config: valid ones parse, others do not', () => {
    expect(CarromRoomConfigSchema.safeParse({ format: '2v2', preset: 'point', length: { kind: 'points', target: 300 } }).success).toBe(true);
    expect(CarromRoomConfigSchema.safeParse({ format: '1v1', preset: 'colour', length: { kind: 'board' } }).success).toBe(true);
    expect(CarromRoomConfigSchema.safeParse({ format: '3v3', preset: 'colour', length: { kind: 'board' } }).success).toBe(false);
    expect(CarromRoomConfigSchema.safeParse({ format: '1v1', preset: 'colour', length: { kind: 'points', target: 20 } }).success).toBe(false);
  });

  it('HUB-5 create options carry a game id and its config', () => {
    expect(CreateRoomOptionsSchema.safeParse({ gameId: 'carrom', config: { format: '1v1' } }).success).toBe(true);
    expect(CreateRoomOptionsSchema.safeParse({ gameId: '', config: {} }).success).toBe(false);
    expect(CreateRoomOptionsSchema.safeParse({ gameId: 'carrom' }).success).toBe(false);
  });

  it('ROOM-3 start, swap and (CB-8) seatBot parse; a seat out of range does not', () => {
    expect(parseClientMessage({ type: 'start' })).toEqual({ type: 'start' });
    expect(parseClientMessage({ type: 'swap', a: 0, b: 2 })).toEqual({ type: 'swap', a: 0, b: 2 });
    expect(parseClientMessage({ type: 'swap', a: 0, b: 4 })).toBeNull();
    expect(parseClientMessage({ type: 'seatBot', seat: 3, on: true })).toEqual({ type: 'seatBot', seat: 3, on: true });
    expect(parseClientMessage({ type: 'seatBot', seat: 4, on: true })).toBeNull();
  });

  it('ROOM-7 HUB-5 server game, timeout, clock and moveResult with durationMs parse', () => {
    const view = { turnSeat: 0 };
    expect(parseServerMessage({ type: 'game', view, turnId: 0 })).not.toBeNull();
    expect(parseServerMessage({ type: 'timeout', turnId: 1, seat: 0, events: [], view })).not.toBeNull();
    expect(parseServerMessage({ type: 'clock', turnId: 1, ms: 21_000 })).not.toBeNull();
    const move = { type: 'moveResult', turnId: 0, seat: 0, move: input, events: [], hash: 'ab', view };
    expect(parseServerMessage({ ...move, durationMs: 1200 })).not.toBeNull();
    expect(parseServerMessage(move)).toBeNull();
    expect(parseServerMessage({ type: 'game', turnId: 0 })).toBeNull();
  });

  it('HUB-4 lobbyConfig parses the lobby config JSON', () => {
    expect(lobbyConfig({ config: '{"format":"1v1"}' })).toEqual({ format: '1v1' });
    expect(lobbyConfig({ config: '{nope' })).toBeNull();
  });
});
