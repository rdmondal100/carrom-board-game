import { describe, expect, it } from 'vitest';
import { B, W, game, play } from './testkit';

describe('point game (preset B)', () => {
  it('any coin is legal for either side', () => {
    const { state } = play(game('point'), [['b1'], ['w1']]);
    expect(state.pocketed.A).toEqual(['b1', 'w1']);
    expect(state.turnSeat).toBe(0);
    expect(state.teamColour).toEqual({ A: null, B: null });
  });

  it('a board totals 155: white 10, black 5, red 20', () => {
    const { state, events } = play(game('point'), [
      ['w1'], ['red'], ['w2'], [], [...W.slice(2), ...B],
    ]);
    expect(state.scores).toEqual({ A: 40, B: 115 });
    expect(state.scores.A + state.scores.B).toBe(155);
    expect(events).toContainEqual({ type: 'boardEnd', winner: 'B', points: 115 });
    expect(events).toContainEqual({ type: 'gameEnd', winner: 'B' });
  });

  it('red uncovered returns and the turn passes', () => {
    const { state, events } = play(game('point'), [['w1'], ['red'], []]);
    expect(events).toContainEqual({ type: 'returned', id: 'red', reason: 'red not covered' });
    expect(state.board.pieces.find((p) => p.id === 'red')?.pocketed).toBe(false);
    expect(state.pocketed.A).toEqual(['w1']);
    expect(state.turnSeat).toBe(2);
  });

  it('RUL-7 nobody may pocket the last coin while red is on the board', () => {
    const { state, events } = play(game('point'), [[...W, ...B]]);
    expect(events).toContainEqual({
      type: 'returned', id: 'b9', reason: 'last coin while red is on the board',
    });
    expect(state.pocketed.A).toHaveLength(17);
    expect(state.turnSeat).toBe(2);
  });

  it('first to 300 is checked when a board ends', () => {
    const near = { ...game('point', '1v1', { kind: 'points', target: 300 }), scores: { A: 250, B: 0 } };
    const { state, events } = play(near, [['w1'], ['red'], ['w2'], [...W.slice(2), ...B]]);
    expect(state.scores.A).toBe(405);
    expect(events).toContainEqual({ type: 'gameEnd', winner: 'A' });
  });
});
