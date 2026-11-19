import { describe, expect, it } from 'vitest';
import { B, W, game, play, shoot } from './testkit';

const red = (s: { board: { pieces: { id: string; pocketed: boolean; x: number; y: number }[] } }) =>
  s.board.pieces.find((p) => p.id === 'red');

describe('colour game (preset A)', () => {
  it('breaking side plays white', () => {
    const g = game('colour', '1v1', { kind: 'board' }, 2);
    expect(g.teamColour).toEqual({ A: 'black', B: 'white' });
  });

  it('RUL-4 pocketing a legal coin keeps the turn', () => {
    const { state, events } = shoot(game('colour'), ['w1']);
    expect(state.turnSeat).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'turn', seat: 0 });
    expect(state.pocketed.A).toEqual(['w1']);
  });

  it("opponent's coin stays down for them; turn passes unless an own coin dropped too", () => {
    const only = shoot(game('colour'), ['b1']);
    expect(only.state.pocketed.B).toEqual(['b1']);
    expect(only.state.turnSeat).toBe(2);
    const both = shoot(game('colour'), ['b1', 'w1']);
    expect(both.state.pocketed).toEqual({ A: ['w1'], B: ['b1'] });
    expect(both.state.turnSeat).toBe(0);
  });

  it('RUL-5 red before the side has a coin returns to centre', () => {
    const { state, events } = shoot(game('colour'), ['red']);
    expect(events).toContainEqual({ type: 'returned', id: 'red', reason: 'red before a coin' });
    expect(red(state)).toMatchObject({ pocketed: false, x: 0, y: 0 });
    expect(state.turnSeat).toBe(2);
  });

  it('RUL-5 red with an own coin in the same shot is legal and covered', () => {
    const { state, events } = shoot(game('colour'), ['w1', 'red']);
    expect(events).toContainEqual({ type: 'redCovered', team: 'A' });
    expect(state.pocketed.A).toEqual(['w1', 'red']);
  });

  it('RUL-6 red covered on the next shot', () => {
    const { state, events } = play(game('colour'), [['w1'], ['red'], ['w2']]);
    expect(events).toContainEqual({ type: 'redCovered', team: 'A' });
    expect(state.pocketed.A).toEqual(['w1', 'w2', 'red']);
    expect(state.redPending).toBeNull();
    expect(state.turnSeat).toBe(0);
  });

  it('RUL-6 red not covered on the next shot returns and the turn passes', () => {
    const mid = play(game('colour'), [['w1'], ['red']]);
    expect(mid.state.redPending).toEqual({ seat: 0, shotsLeft: 1 });
    expect(mid.state.turnSeat).toBe(0);
    const { state, events } = shoot(mid.state, ['b1']);
    expect(events).toContainEqual({ type: 'returned', id: 'red', reason: 'red not covered' });
    expect(red(state)?.pocketed).toBe(false);
    expect(state.pocketed.B).toEqual(['b1']);
    expect(state.turnSeat).toBe(2);
  });

  it('RUL-7 a side may not pocket its last coin while red is on the board', () => {
    const { state, events } = play(game('colour'), [W.slice(0, 8), ['w9']]);
    expect(events).toContainEqual({
      type: 'returned', id: 'w9', reason: 'last coin while red is on the board',
    });
    expect(state.pocketed.A).toHaveLength(8);
    expect(state.turnSeat).toBe(2);
    expect(state.winner).toBeNull();
  });

  it("RUL-7 pocketing the opponent's last coin while red is on the board returns it", () => {
    const { state, events } = play(game('colour'), [B.slice(0, 8), [], ['b9']]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'returned', id: 'b9' }));
    expect(state.pocketed.B).toHaveLength(8);
  });

  it("pocketing the opponent's last coin with red covered wins the board for them", () => {
    const { state, events } = play(game('colour'), [
      ['w1'], ['red'], ['w2'], B.slice(0, 8), [], ['b9'],
    ]);
    // Winner B scores A's 7 coins left; red was covered by A, so no bonus.
    expect(events).toContainEqual({ type: 'boardEnd', winner: 'B', points: 7 });
    expect(state.winner).toBe('B');
  });

  it('a scripted board ending 7–0 with red covered scores 12', () => {
    const { state, events } = play(game('colour'), [
      [], ['b1', 'b2'], [], ['w1'], ['red'], ['w2'], W.slice(2),
    ]);
    expect(events).toContainEqual({ type: 'boardEnd', winner: 'A', points: 12 });
    expect(events).toContainEqual({ type: 'gameEnd', winner: 'A' });
    expect(state.scores).toEqual({ A: 12, B: 0 });
  });

  it('red cut-off at 24 in a 29-point game', () => {
    const script = [['w1'], ['red'], ['w2'], W.slice(2)];
    const at24 = { ...game('colour', '1v1', { kind: 'points', target: 29 }), scores: { A: 24, B: 0 } };
    expect(play(at24, script).events).toContainEqual({ type: 'boardEnd', winner: 'A', points: 9 });
    const at23 = { ...at24, scores: { A: 23, B: 0 } };
    expect(play(at23, script).events).toContainEqual({ type: 'boardEnd', winner: 'A', points: 14 });
  });

  it('9-board cap decides the winner', () => {
    const script = [['w1'], ['red'], ['w2'], W.slice(2)];
    const base = game('colour', '1v1', { kind: 'points', target: 29 });
    const board8 = { ...base, boardNo: 8, scores: { A: 0, B: 14 } };
    const after8 = play(board8, script).state;
    expect(after8.winner).toBeNull();
    expect(after8.boardNo).toBe(9);
    expect(after8.scores).toEqual({ A: 14, B: 14 });

    const board9 = { ...base, boardNo: 9, scores: { A: 10, B: 14 } };
    const { state, events } = play(board9, script);
    expect(state.scores).toEqual({ A: 24, B: 14 });
    expect(events).toContainEqual({ type: 'gameEnd', winner: 'A' });
  });
});
