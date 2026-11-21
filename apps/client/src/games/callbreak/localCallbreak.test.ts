import { beforeEach, describe, expect, it } from 'vitest';
import { botMove, botTurn, ME, moveLocal, myView, rematchLocal, startLocal, takeBack, timeoutLocal, vsBotResult, type LocalCallbreak } from './localCallbreak';
import { clearCallbreakSave, loadCallbreak, saveCallbreak } from './save';

const names = ['Rina', 'Bot 2', 'Bot 3', 'Bot 4'];
const start = (seed = 3): LocalCallbreak => startLocal({ rounds: 3, redeal: true }, names, ['medium', 'easy', 'medium', 'hard'], true, seed);

/** Let the bots play until it is your turn (or the game ends). */
function toMyTurn(g: LocalCallbreak): LocalCallbreak {
  let x = g;
  for (let i = 0; botTurn(x) !== null && i < 100; i++) x = botMove(x, i)!.game;
  return x;
}

describe('callbreak vs bots', () => {
  beforeEach(() => localStorage.clear());

  it('CB-7 you sit at seat 0 and see only your own hand; bots play their turns', () => {
    const g = toMyTurn(start());
    expect(g.state.turnSeat).toBe(ME);
    expect(myView(g).hand).toEqual(g.state.hands[ME]);
    expect(JSON.stringify(myView(g))).not.toContain(JSON.stringify(g.state.hands[1]));
    expect(botTurn(g)).toBeNull();
    const step = moveLocal(g, { bid: 3 });
    expect(step?.game.state.bids[ME]).toBe(3);
    expect(moveLocal(g, { card: g.state.hands[ME]![0]! })).toBeNull(); // still bidding
  });

  it('CB-4 two timeouts in a row hand your seat to the bot until you take it back', () => {
    let g = toMyTurn(start());
    g = toMyTurn(timeoutLocal(g).game);
    expect(g.takeover).toBe(false);
    g = timeoutLocal(g).game;
    expect(g.takeover).toBe(true);
    expect(botTurn({ ...g, state: { ...g.state, turnSeat: ME } })).toBe('medium');
    expect(takeBack(g).takeover).toBe(false);
  });

  it('CB-7 the game saves and loads; a broken save reads as none', () => {
    const g = start(9);
    saveCallbreak(g);
    expect(loadCallbreak()).toEqual(g);
    localStorage.setItem('callbreak.localGame', JSON.stringify({ v: 1, game: { state: {} } }));
    expect(loadCallbreak()).toBeNull();
    clearCallbreakSave();
    expect(loadCallbreak()).toBeNull();
  });

  it('COS-2 a finished game is a win only when you top the totals; a rematch deals afresh', () => {
    const g = start();
    expect(vsBotResult(g)).toBeNull();
    expect(vsBotResult({ ...g, state: { ...g.state, winner: '0' } })).toBe(true);
    expect(vsBotResult({ ...g, state: { ...g.state, winner: '2' } })).toBe(false);
    const r = rematchLocal(g);
    expect(r.state.dealer).toBe((g.state.dealer + 1) % 4);
    expect(r.names).toEqual(names);
  });
});
