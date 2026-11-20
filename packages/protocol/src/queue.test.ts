import { describe, expect, it } from 'vitest';
import { parseQueueMessage } from './queue';
import { parseServerMessage } from './schemas';

describe('ranked protocol', () => {
  it('RANK-2 queue status, bot offer and matched parse', () => {
    expect(parseQueueMessage({ type: 'queue', waitedMs: 5000, window: 150, rating: 1000 })).not.toBeNull();
    expect(parseQueueMessage({ type: 'botOffer' })).toEqual({ type: 'botOffer' });
    const reservation = { name: 'ranked', roomId: 'r1', sessionId: 's1', processId: 'p1' };
    expect(parseQueueMessage({ type: 'matched', reservation })).toEqual({ type: 'matched', reservation });
    expect(parseQueueMessage({ type: 'matched', reservation: { roomId: 'r1' } })).toBeNull();
    expect(parseQueueMessage({ type: 'queue', waitedMs: -1, window: 100, rating: 1000 })).toBeNull();
  });

  it('RANK-4 rankedResult parses; ratings must be integers', () => {
    const players = [
      { seat: 0, userId: 'a', ratingBefore: 1000, ratingAfter: 1016 },
      { seat: 2, userId: 'b', ratingBefore: 1000, ratingAfter: 984 },
    ];
    expect(parseServerMessage({ type: 'rankedResult', winner: 'A', abandoned: false, players })).not.toBeNull();
    const bad = [{ ...players[0], ratingAfter: 1016.5 }];
    expect(parseServerMessage({ type: 'rankedResult', winner: 'A', abandoned: false, players: bad })).toBeNull();
    expect(parseServerMessage({ type: 'rankedResult', winner: 'C', abandoned: false, players })).toBeNull();
  });
});
