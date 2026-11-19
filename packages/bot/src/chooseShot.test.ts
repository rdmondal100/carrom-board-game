import { describe, expect, test } from 'vitest';
import { config as engine, placeStriker, pocketCentre, simulateShot, type PocketId } from '@carrom/engine';
import { newGame, teamOf, type Format, type GameState, type Preset } from '@carrom/rules';
import { addNoise, chooseShot } from './chooseShot';
import { LEVELS, type BotLevel } from './config';
import { mulberry32 } from './random';
import { randomMidGame } from './testkit';

const LEVEL_LIST: BotLevel[] = ['easy', 'medium', 'hard'];
const PRESETS: Preset[] = ['colour', 'point'];
const FORMATS: Format[] = ['1v1', '2v2'];

describe('chooseShot', () => {
  test('BOT-1 legal input for 200 seeded random mid-game states, all presets/formats', () => {
    for (let i = 0; i < 200; i++) {
      const g = randomMidGame(i, PRESETS[i % 2] as Preset, FORMATS[(i >> 1) % 2] as Format);
      const s = chooseShot(g, LEVEL_LIST[i % 3] as BotLevel, i);
      expect(s.seat).toBe(g.turnSeat);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(engine.BASELINE_HALF);
      expect(placeStriker(g.board, s.seat, s.x)).toEqual({ ok: true, x: s.x });
      expect(Math.abs(s.dirX * s.dirX + s.dirY * s.dirY - 1)).toBeLessThan(1e-9);
      expect(s.dirY).toBeGreaterThanOrEqual(engine.MIN_AIM_FORWARD);
      expect(s.power).toBeGreaterThanOrEqual(engine.MIN_POWER);
      expect(s.power).toBeLessThanOrEqual(engine.MAX_POWER);
      expect(() => simulateShot(g.board, s)).not.toThrow();
    }
  }, 300_000);

  test('BOT-2 same state, level and seed give the same shot; another seed can differ', () => {
    const g = randomMidGame(5, 'colour', '1v1');
    expect(chooseShot(g, 'medium', 9)).toEqual(chooseShot(g, 'medium', 9));
    const shots = new Set([1, 2, 3, 4].map((s) => JSON.stringify(chooseShot(g, 'medium', s))));
    expect(shots.size).toBeGreaterThan(1);
  });

  test('BOT-3 easy pot: hard pots an own coin 0.1 L in front of a pocket in ≥ 90% of 50 seeds', () => {
    // Mid-game: each side has 5 coins down; 3 + 4 coins and red sit near the
    // centre (what's left of the rack), the target is by a far pocket.
    const base = newGame({ preset: 'colour', format: '1v1', length: { kind: 'board' }, seed: 1 });
    const team = teamOf(base.turnSeat, '1v1');
    const opp = team === 'A' ? 'B' : 'A';
    const ids = (kind: string | null) => base.board.pieces.filter((p) => p.kind === kind).map((p) => p.id);
    const own = ids(base.teamColour[team]);
    const theirs = ids(base.teamColour[opp]);
    const target = own[0] as string;
    const down = [...own.slice(4), ...theirs.slice(4)];
    // A pocket on the far side from the shooter, coin 0.1 L toward the centre.
    const pocket: PocketId = base.turnSeat === 0 ? 2 : 0;
    const pc = pocketCentre(pocket, engine);
    const len = Math.sqrt(pc.x * pc.x + pc.y * pc.y);
    const spot = { x: pc.x - (pc.x / len) * 0.1, y: pc.y - (pc.y / len) * 0.1 };
    const g: GameState = {
      ...base,
      board: {
        pieces: base.board.pieces.map((p) =>
          p.id === target ? { ...p, ...spot } : { ...p, pocketed: down.includes(p.id) }),
      },
      pocketed: { [team]: own.slice(4), [opp]: theirs.slice(4) } as GameState['pocketed'],
    };
    let potted = 0;
    for (let seed = 0; seed < 50; seed++) {
      const shot = simulateShot(g.board, chooseShot(g, 'hard', seed));
      if (shot.events.some((e) => e.type === 'pocket' && e.id === target)) potted++;
    }
    expect(potted).toBeGreaterThanOrEqual(45);
  }, 120_000);

  test('BOT-5 hard move timing ≤ 2 s', () => {
    const states = [
      newGame({ preset: 'colour', format: '1v1', length: { kind: 'board' }, seed: 1 }),
      newGame({ preset: 'point', format: '2v2', length: { kind: 'points', target: 300 }, seed: 2 }),
      randomMidGame(11, 'colour', '1v1'),
      randomMidGame(12, 'point', '2v2'),
    ];
    for (const g of states) {
      const t0 = Date.now();
      chooseShot(g, 'hard', 1);
      expect(Date.now() - t0).toBeLessThanOrEqual(2000);
    }
  }, 60_000);

  test('BOT-4 noise stays inside the level limits', () => {
    const rand = mulberry32(3);
    const input = { seat: 0 as const, x: 0, dirX: 0, dirY: 1, power: 0.5 };
    for (const level of Object.values(LEVELS)) {
      for (let i = 0; i < 200; i++) {
        const n = addNoise(input, level, rand);
        expect(Math.abs(n.dirX)).toBeLessThanOrEqual(level.aimNoiseSin + 1e-12);
        expect(Math.abs(n.power - 0.5)).toBeLessThanOrEqual(0.5 * level.powerNoise + 1e-12);
      }
    }
  });
});
