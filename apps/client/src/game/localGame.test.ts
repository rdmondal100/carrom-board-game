import { describe, expect, it } from 'vitest';
import { simulateShot, type Seat, type ShotInput } from '@carrom/engine';
import { applyShot, applyTimeout, newGame, type GameConfig } from '@carrom/rules';
import {
  botLevelAt, seatName, shootLocal, startLocal, takeBack, takeOver, TAKEOVER_LEVEL, timeoutLocal, vsBotResult,
} from './localGame';

const CFG: GameConfig = { format: '2v2', preset: 'point', length: { kind: 'points', target: 300 }, seed: 7 };
const NAMES = ['Asha', 'Bilu', 'Chandni', 'Dipu'];

// Seat-relative aims; the seat comes from whoever's turn it is.
const SCRIPT: Omit<ShotInput, 'seat'>[] = [
  { x: 0, dirX: 0, dirY: 1, power: 1 },
  { x: 0.1, dirX: 0.3, dirY: 0.95, power: 0.6 },
  { x: -0.2, dirX: -0.5, dirY: 0.8, power: 0.8 },
  { x: 0.25, dirX: 0.1, dirY: 1, power: 0.4 },
  { x: 0, dirX: -0.2, dirY: 1, power: 0.9 },
  { x: -0.1, dirX: 0.7, dirY: 0.7, power: 0.5 },
];

describe('localGame', () => {
  it('LOC-2 a scripted run through the controller equals simulateShot + applyShot', () => {
    let g = startLocal(CFG, NAMES, true);
    let direct = newGame(CFG);
    expect(g.state).toEqual(direct);
    for (const s of SCRIPT) {
      const input: ShotInput = { ...s, seat: g.state.turnSeat as Seat };
      const before = g.state.board;
      const out = shootLocal(g, input);
      const sim = simulateShot(direct.board, { ...s, seat: direct.turnSeat as Seat });
      const ref = applyShot(direct, sim.events, sim.final);
      expect(out.game.state).toEqual(ref.state);
      expect(out.ruleEvents).toEqual(ref.events);
      expect(out.shot).toEqual({ start: before, input });
      g = out.game;
      direct = ref.state;
    }
    expect(g.names).toEqual(NAMES);
  });

  it('LOC-2 timeoutLocal equals applyTimeout', () => {
    const g = startLocal(CFG, NAMES, true);
    const out = timeoutLocal(g);
    const ref = applyTimeout(g.state);
    expect(out.game.state).toEqual(ref.state);
    expect(out.ruleEvents).toEqual(ref.events);
  });

  it('LOC-2 seatName maps players to seats', () => {
    const two = startLocal({ ...CFG, format: '1v1' }, ['Asha', 'Bilu'], false);
    expect(seatName(two, 0)).toBe('Asha');
    expect(seatName(two, 2)).toBe('Bilu');
    expect(seatName(two, 1)).toBe('');
    const four = startLocal(CFG, NAMES, false);
    expect([0, 1, 2, 3].map((s) => seatName(four, s))).toEqual(NAMES);
  });

  it('BOT-6 botLevelAt follows the seating chosen in setup', () => {
    const g = startLocal({ ...CFG, format: '1v1' }, ['Asha', 'Bot'], false, ['human', 'hard']);
    expect(botLevelAt(g, 0)).toBeNull();
    expect(botLevelAt(g, 2)).toBe('hard');
    // Older callers pass no seating: everyone is a person.
    expect(startLocal(CFG, NAMES, false).players).toEqual(['human', 'human', 'human', 'human']);
  });

  it('BOT-7 two timeouts in a row hand the seat to a medium bot until take back', () => {
    let g = startLocal({ ...CFG, format: '1v1' }, ['Asha', 'Bilu'], true);
    const seat = g.state.turnSeat;
    const other = seat === 0 ? 2 : 0;
    g = timeoutLocal(g).game; // seat times out
    g = timeoutLocal(g).game; // other seat times out
    expect(g.takeover).toEqual([]);
    const out = timeoutLocal(g); // seat's second timeout in a row
    expect(out.ruleEvents.some((e) => e.type === 'botTakeover' && e.seat === seat)).toBe(true);
    expect(botLevelAt(out.game, seat)).toBe(TAKEOVER_LEVEL);
    expect(botLevelAt(out.game, other)).toBeNull();
    const back = takeBack(out.game, seat);
    expect(botLevelAt(back, seat)).toBeNull();
    expect(back.takeover).toEqual([]);
  });

  it('BOT-7 a bot seat is never taken over a second time', () => {
    const g = startLocal({ ...CFG, format: '1v1' }, ['Bot', 'Bilu'], true, ['easy', 'human']);
    expect(takeOver(g, 0)).toBe(g);
    expect(botLevelAt(takeOver(g, 2), 2)).toBe(TAKEOVER_LEVEL);
  });
});

describe('COS-2 Vs-bot result', () => {
  it('COS-2 people on one side vs bots: won/lost; same-device or mixed sides: no reward', () => {
    const one = { ...CFG, format: '1v1' as const };
    const vsBot = startLocal(one, ['Asha', 'Bot'], false, ['human', 'medium']);
    expect([vsBotResult(vsBot, 'A'), vsBotResult(vsBot, 'B')]).toEqual([true, false]);
    expect(vsBotResult(startLocal(one, ['Asha', 'Bilu'], false), 'A')).toBeNull();
    // 2v2: Asha + a bot partner vs two bots still counts; people on both teams does not.
    expect(vsBotResult(startLocal(CFG, NAMES, false, ['human', 'easy', 'hard', 'medium']), 'B')).toBe(false);
    expect(vsBotResult(startLocal(CFG, NAMES, false, ['human', 'human', 'hard', 'medium']), 'A')).toBeNull();
  });
});
