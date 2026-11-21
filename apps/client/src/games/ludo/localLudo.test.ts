import { DEFAULT_LUDO_CONFIG, LUDO } from '@hub/ludo';
import { beforeEach, describe, expect, it } from 'vitest';
import { botMove, botTurn, moveLocal, rematchLocal, startLocal, takeBack, timeoutLocal, vsBotResult, winnerLabel, type LocalLudo } from './localLudo';
import { clearLudoSave, loadLudo, LUDO_SAVE_KEY, saveLudo } from './save';
import { configOf, defaultLudoSetup, ludoSetupSchema } from './schemas/ludoSetup';

const names = ['Anik', 'Bina', 'Chayan', 'Dola'];

function playToEnd(g: LocalLudo): LocalLudo {
  let cur = g;
  for (let i = 0; i < 5000 && cur.state.winner === null; i++) {
    const step = botMove(cur, i + 1);
    if (!step) throw new Error('bot move refused');
    cur = step.game;
  }
  return cur;
}

describe('ludo same-device game', () => {
  beforeEach(() => localStorage.clear());

  it('LUDO-6 vs bot: bots move by themselves; a person moves by tapping a legal token', () => {
    const g = startLocal(DEFAULT_LUDO_CONFIG, names, ['human', 'easy', 'hard', 'easy'], false, 7);
    const seat = g.state.turnSeat;
    expect(botTurn(g)).toBe(seat === 0 ? null : 'hard');
    if (seat === 0) {
      expect(moveLocal(g, { token: 9 } as never)).toBeNull();
      const legal = g.state.tokens[0]!.findIndex((p) => p === LUDO.YARD);
      expect(moveLocal(g, { token: legal })?.game.state.turnId).toBe(1);
    }
    const end = playToEnd(g);
    expect(end.state.winner === '0' || end.state.winner === '2').toBe(true);
    expect(vsBotResult(end)).toBe(end.state.winner === '0');
    expect(winnerLabel(end.state.config, names, end.state.winner!)).toBe(names[Number(end.state.winner)]);
  });

  it('LUDO-4 two timeouts → the bot takes the seat; take back control returns it', () => {
    let g = startLocal({ ...DEFAULT_LUDO_CONFIG, players: 4 }, names, ['human', 'human', 'human', 'human'], true, 3);
    for (let i = 0; i < 8; i++) g = timeoutLocal(g).game;
    expect(g.takeover.length).toBeGreaterThan(0);
    const seat = g.takeover[0]!;
    expect(new Set(g.takeover).size).toBe(g.takeover.length);
    const back = takeBack(g, seat);
    expect(back.takeover).not.toContain(seat);
    expect(back.state.timeouts[seat]).toBe(0);
  });

  it('LUDO-6 rematch keeps the settings and players; 2 people on different sides earn no vs-bot reward', () => {
    const g = startLocal(DEFAULT_LUDO_CONFIG, names, ['human', 'human', 'human', 'human'], false, 9);
    const end = playToEnd(g);
    expect(vsBotResult(end)).toBeNull();
    const again = rematchLocal(end);
    expect(again.state.winner).toBeNull();
    expect(again.names).toEqual(names);
    expect(again.state.config).toEqual(end.state.config);
  });

  it('LUDO-6 the game saves and loads; a broken save reads as none', () => {
    const g = startLocal({ ...DEFAULT_LUDO_CONFIG, tapToRoll: true }, names, ['human', 'medium', 'human', 'medium'], true, 4);
    saveLudo(g);
    expect(loadLudo()).toEqual(g);
    localStorage.setItem(LUDO_SAVE_KEY, JSON.stringify({ v: 1, game: { ...g, players: ['robot'] } }));
    expect(loadLudo()).toBeNull();
    clearLudoSave();
    expect(loadLudo()).toBeNull();
  });

  it('LUDO-2 setup form: counts map to configs; names are needed only for seats in play', () => {
    expect(configOf({ preset: 'bd', count: '2v2', quick: false, tapToRoll: false })).toMatchObject({ players: 4, teams: true });
    expect(configOf({ preset: 'classic', count: '3', quick: true, tapToRoll: true })).toEqual({ preset: 'classic', players: 3, teams: false, quick: true, tapToRoll: true });
    const v = { ...defaultLudoSetup(true), names: ['Me', '', 'Bot', ''] };
    expect(ludoSetupSchema.safeParse(v).success).toBe(true); // 2 players: seats 0 and 2
    expect(ludoSetupSchema.safeParse({ ...v, count: '4' }).success).toBe(false);
  });
});
