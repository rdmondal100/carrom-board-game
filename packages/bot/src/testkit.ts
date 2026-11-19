// Test helpers: seeded random games and bot-vs-bot matches.
import { config as engine, placeStriker, simulateShot, type Seat, type ShotInput } from '@carrom/engine';
import { applyShot, newGame, teamOf, type Format, type GameState, type Preset, type Team } from '@carrom/rules';
import { chooseShot } from './chooseShot';
import type { BotLevel } from './config';
import { mulberry32, signed } from './random';

/** A random but legal shot: any spot, any direction, any power. */
export function randomShot(g: GameState, rand: () => number): ShotInput {
  const seat = g.turnSeat as Seat;
  const spot = placeStriker(g.board, seat, signed(rand) * engine.BASELINE_HALF);
  let dirX = signed(rand);
  let dirY = signed(rand);
  const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
  dirX /= len;
  dirY /= len;
  const power = engine.MIN_POWER + rand() * (engine.MAX_POWER - engine.MIN_POWER);
  return { seat, x: spot.x, dirX, dirY, power };
}

export function play(g: GameState, input: ShotInput): GameState {
  const shot = simulateShot(g.board, input);
  return applyShot(g, shot.events, shot.final).state;
}

/** A game after 0..maxShots random shots (stops before the game ends). */
export function randomMidGame(
  seed: number, preset: Preset, format: Format, maxShots = 20,
): GameState {
  const rand = mulberry32(seed);
  const length = preset === 'colour' ? { kind: 'board' as const } : { kind: 'points' as const, target: 300 as const };
  let g = newGame({ preset, format, length, seed });
  const shots = Math.floor(rand() * (maxShots + 1));
  for (let i = 0; i < shots; i++) {
    const next = play(g, randomShot(g, rand));
    if (next.winner !== null) break;
    g = next;
  }
  return g;
}

/** One-board 1 v 1 colour game between two bot levels; returns the winning team's level. */
export function botMatch(seed: number, a: BotLevel, b: BotLevel, maxShots = 300): { winner: Team | null; shots: number } {
  let g = newGame({ preset: 'colour', format: '1v1', length: { kind: 'board' }, seed });
  let n = 0;
  while (g.winner === null && n < maxShots) {
    const level = teamOf(g.turnSeat, g.config.format) === 'A' ? a : b;
    g = play(g, chooseShot(g, level, seed * 1000 + n));
    n++;
  }
  return { winner: g.winner, shots: n };
}
