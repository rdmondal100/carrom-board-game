import { describe, expect, it } from 'vitest';
import { CreateRoomOptionsSchema, EMOTES, INVITE_ALPHABET, lengthOf } from './room';
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

  it('ROOM-1 create options: valid ones parse, others do not', () => {
    expect(CreateRoomOptionsSchema.safeParse({ format: '2v2', preset: 'point', length: { kind: 'points', target: 300 } }).success).toBe(true);
    expect(CreateRoomOptionsSchema.safeParse({ format: '1v1', preset: 'colour', length: { kind: 'board' } }).success).toBe(true);
    expect(CreateRoomOptionsSchema.safeParse({ format: '3v3', preset: 'colour', length: { kind: 'board' } }).success).toBe(false);
    expect(CreateRoomOptionsSchema.safeParse({ format: '1v1', preset: 'colour', length: { kind: 'points', target: 20 } }).success).toBe(false);
  });

  it('ROOM-3 start and swap parse; a seat out of range does not', () => {
    expect(parseClientMessage({ type: 'start' })).toEqual({ type: 'start' });
    expect(parseClientMessage({ type: 'swap', a: 0, b: 2 })).toEqual({ type: 'swap', a: 0, b: 2 });
    expect(parseClientMessage({ type: 'swap', a: 0, b: 4 })).toBeNull();
  });

  it('ROOM-7 server game, timeout, clock and shotResult with durationMs parse', () => {
    const state = { turnSeat: 0 };
    expect(parseServerMessage({ type: 'game', state, turnId: 0 })).not.toBeNull();
    expect(parseServerMessage({ type: 'timeout', turnId: 1, seat: 0, ruleEvents: [], state })).not.toBeNull();
    expect(parseServerMessage({ type: 'clock', turnId: 1, ms: 21_000 })).not.toBeNull();
    const shot = { type: 'shotResult', turnId: 0, seat: 0, input, ruleEvents: [], stateHash: 'ab', state };
    expect(parseServerMessage({ ...shot, durationMs: 1200 })).not.toBeNull();
    expect(parseServerMessage(shot)).toBeNull();
  });

  it('ROOM-3 lengthOf reads the lobby fields', () => {
    expect(lengthOf({ lengthKind: 'points', target: 29 })).toEqual({ kind: 'points', target: 29 });
    expect(lengthOf({ lengthKind: 'board', target: 0 })).toEqual({ kind: 'board' });
  });
});
