import { describe, expect, it } from 'vitest';
import { lobbyFromState } from './lobbyState';

const whole = {
  code: 'ABCD', phase: 'playing', gameId: 'ludo', config: '{}', hostId: 'h', ranked: false,
  players: { s1: { sessionId: 's1', userId: 'u1' } },
};

describe('lobbyFromState', () => {
  it('ROOM-8 a whole room state passes through', () => {
    expect(lobbyFromState(whole)?.players.s1?.userId).toBe('u1');
  });

  it('ROOM-8 a half-synced state (no players yet) is held back', () => {
    expect(lobbyFromState({ ...whole, players: undefined })).toBeNull();
    expect(lobbyFromState({})).toBeNull();
    expect(lobbyFromState(null)).toBeNull();
    expect(lobbyFromState({ ...whole, players: { s1: null } })).toBeNull();
  });

  it('ROOM-8 missing gameId and config get safe defaults', () => {
    const l = lobbyFromState({ ...whole, gameId: undefined, config: undefined });
    expect(l?.gameId).toBe('');
    expect(l?.config).toBe('{}');
  });
});
