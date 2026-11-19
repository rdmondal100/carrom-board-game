import { config, type Config } from './config';
import { placeStriker } from './rack';
import { baselinePoint, seatToWorld } from './seats';
import { advanceInPlace, cloneState, isAtRest } from './step';
import type { BoardState, Piece, ShotEvent, ShotInput } from './types';

/**
 * Put the striker on the seat's baseline, shoot it, and run steps until
 * every piece rests (or MAX_SHOT_MS passes). Returns a new state.
 * Throws RangeError on an aim past MAX_AIM_ANGLE_DEG or a blocked baseline.
 */
export function simulateShot(
  state: BoardState, input: ShotInput, cfg: Config = config,
): { final: BoardState; events: ShotEvent[]; durationMs: number } {
  const len = Math.sqrt(input.dirX * input.dirX + input.dirY * input.dirY);
  if (len === 0) throw new RangeError('Shot direction is zero');
  const dirX = input.dirX / len;
  const dirY = input.dirY / len;
  if (dirY < cfg.MIN_AIM_FORWARD) {
    throw new RangeError(`Aim is past ${cfg.MAX_AIM_ANGLE_DEG}° from straight ahead`);
  }

  const place = placeStriker(state, input.seat, input.x, cfg);
  if (!place.ok) throw new RangeError('No free spot for the striker on the baseline');

  const power = Math.min(cfg.MAX_POWER, Math.max(cfg.MIN_POWER, input.power));
  const speed = cfg.MAX_SPEED * power;
  const dir = seatToWorld(input.seat, dirX, dirY);
  const pos = baselinePoint(input.seat, place.x, cfg);

  const board = cloneState(state);
  const striker = board.pieces.find((p) => p.kind === 'striker');
  if (!striker) throw new RangeError('Board has no striker');
  striker.x = pos.x;
  striker.y = pos.y;
  striker.vx = dir.x * speed;
  striker.vy = dir.y * speed;
  striker.pocketed = false;

  const events: ShotEvent[] = [];
  const stepMs = cfg.DT * 1000;
  const maxSteps = Math.ceil(cfg.MAX_SHOT_MS / stepMs);
  let n = 0;
  while (n < maxSteps && !isAtRest(board)) {
    advanceInPlace(board, n * stepMs, cfg, events);
    n++;
  }
  return { final: board, events, durationMs: n * stepMs };
}

function fnv1a(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A short fingerprint of every piece's exact position, velocity and status. */
export function stateHash(state: BoardState): string {
  const text = [...state.pieces]
    .sort((a: Piece, b: Piece) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => `${p.id}:${p.x},${p.y},${p.vx},${p.vy},${p.pocketed ? 1 : 0}`)
    .join('|');
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01234567);
}
