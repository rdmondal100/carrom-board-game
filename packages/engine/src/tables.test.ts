import { describe, expect, it } from 'vitest';
import { BORSHA_CURRENT, config, NODI, TABLES } from './config';
import { createRack } from './rack';
import { simulateFlick, simulateShot, stateHash } from './shot';
import { step } from './step';
import type { BoardState, Piece, ShotInput, Table } from './types';

const PHY7: ShotInput = { seat: 2, x: 0.07, dirX: 0.05, dirY: 0.99875, power: 1 };

const boat = (id: string, x: number, y: number, vx = 0, vy = 0): Piece => ({
  id, kind: 'boat', x, y, vx, vy, r: NODI.BOAT_D / 2, m: NODI.BOAT_MASS, pocketed: false,
});

function run(board: BoardState, steps: number, table: Table, cfg = config): BoardState {
  let s = board;
  for (let n = 0; n < steps; n++) s = step(s, n * cfg.DT * 1000, cfg, table).state;
  return s;
}

describe('NODI-1 engine tables', () => {
  it('NODI-1 PHY-7 hash is still 2400dfde4a26d384 with TABLES.carrom', () => {
    expect(stateHash(simulateShot(createRack(2), PHY7).final)).toBe('2400dfde4a26d384');
    expect(stateHash(simulateShot(createRack(2), PHY7, config, TABLES.carrom).final)).toBe('2400dfde4a26d384');
  });

  it('NODI-1 a current of zero changes nothing', () => {
    const still = { ...TABLES.carrom, current: { x: 0, y: 0 } };
    expect(stateHash(simulateShot(createRack(2), PHY7, config, still).final)).toBe('2400dfde4a26d384');
    const board = { pieces: [boat('a', -0.3, 0.15, 0.8, -0.4), boat('b', 0.1, -0.1)] };
    const calm = simulateFlick(board, 'a', 0.8, -0.4, TABLES.nodiPar);
    const zero = simulateFlick(board, 'a', 0.8, -0.4, { ...TABLES.nodiPar, current: BORSHA_CURRENT.carrom });
    expect(stateHash(zero.final)).toBe(stateHash(calm.final));
  });

  it('NODI-1 a disc bounces off a rock like off another fixed disc', () => {
    const T = TABLES.nodiPar;
    const rock = T.rocks[1]!;
    const withRock = run({ pieces: [boat('a', -0.25, rock.y + 0.012, 1.5, 0)] }, 240, T);
    const fixed: Piece = { id: 'z', kind: 'white', x: rock.x, y: rock.y, vx: 0, vy: 0, r: rock.r, m: Infinity, pocketed: false };
    const noRock = { ...T, rocks: T.rocks.filter((_, i) => i !== 1) };
    const withDisc = run({ pieces: [boat('a', -0.25, rock.y + 0.012, 1.5, 0), fixed] }, 240, noRock);
    const a = withRock.pieces[0]!;
    const b = withDisc.pieces[0]!;
    expect(a.vy).not.toBe(0); // it really hit the rock
    expect([a.x, a.y, a.vx, a.vy]).toEqual([b.x, b.y, b.vx, b.vy]);
    expect(withDisc.pieces[1]).toMatchObject({ x: rock.x, y: rock.y });
  });

  it('NODI-1 a rock hit is a rock event, and the boat never overlaps the rock', () => {
    const out = simulateFlick({ pieces: [boat('a', 0, 0.4)] }, 'a', 0, -1.2, TABLES.nodiPar);
    expect(out.events.some((e) => e.type === 'rock' && e.id === 'a' && e.rock === 1)).toBe(true);
    const a = out.final.pieces[0]!;
    expect(Math.hypot(a.x, a.y - 0.3)).toBeGreaterThanOrEqual(a.r + NODI.ROCK_R - 1e-9);
  });

  it('NODI-1 with a current, drift matches the closed form within 1e-9', () => {
    const frictionless = { ...config, FRICTION_DECEL: 0, FRICTION_DRAG: 0 };
    const T = { ...TABLES.nodiPar, current: BORSHA_CURRENT.nodiPar };
    const v0 = { x: 0.1, y: 0.02 };
    const start = { x: -0.3, y: 0.15 };
    const n = 240;
    const end = run({ pieces: [boat('a', start.x, start.y, v0.x, v0.y)] }, n, T, frictionless).pieces[0]!;
    const t = n * config.DT;
    const a = T.current;
    expect(Math.abs(end.x - (start.x + v0.x * t + (a.x * t * t) / 2))).toBeLessThan(1e-9);
    expect(Math.abs(end.y - (start.y + v0.y * t + (a.y * t * t) / 2))).toBeLessThan(1e-9);
    expect(Math.abs(end.vx - (v0.x + a.x * t))).toBeLessThan(1e-9);
  });

  it('NODI-1 a resting boat does not drift; Borsha flicks still come to rest', () => {
    const T = { ...TABLES.nodiPar4, current: BORSHA_CURRENT.nodiPar4 };
    const board = { pieces: [boat('a', 0, 0.4), boat('b', 0.1, 0.1)] };
    for (const [vx, vy] of [[0, -3], [1, -2], [-2.5, -1], [0.3, -0.5]] as const) {
      const out = simulateFlick(board, 'a', vx, vy, T);
      expect(out.durationMs).toBeLessThan(config.MAX_SHOT_MS);
    }
    const still = run(board, 100, T).pieces[1]!;
    expect([still.x, still.y]).toEqual([0.1, 0.1]);
    expect(BORSHA_CURRENT.nodiPar.x).toBeLessThan(config.FRICTION_DECEL);
  });
});
