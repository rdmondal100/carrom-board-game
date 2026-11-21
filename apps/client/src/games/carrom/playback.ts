import {
  baselinePoint, cloneState, config, isAtRest, placeStriker, seatToWorld, step,
  type BoardState, type ShotEvent, type ShotInput,
} from '@carrom/engine';
import { MAX_FRAME_MS } from '@/constants/view';

export interface Playback {
  advance(ms: number): { state: BoardState; events: ShotEvent[]; done: boolean };
}

/** Same setup as engine simulateShot, so the final state matches it bit for bit. */
function launch(state: BoardState, input: ShotInput): BoardState {
  const len = Math.sqrt(input.dirX * input.dirX + input.dirY * input.dirY);
  if (len === 0) throw new RangeError('Shot direction is zero');
  const dirX = input.dirX / len;
  const dirY = input.dirY / len;
  if (dirY < config.MIN_AIM_FORWARD) throw new RangeError('Aim is past the limit');
  const place = placeStriker(state, input.seat, input.x);
  if (!place.ok) throw new RangeError('No free spot for the striker on the baseline');

  const power = Math.min(config.MAX_POWER, Math.max(config.MIN_POWER, input.power));
  const speed = config.MAX_SPEED * power;
  const dir = seatToWorld(input.seat, dirX, dirY);
  const pos = baselinePoint(input.seat, place.x);
  const board = cloneState(state);
  const striker = board.pieces.find((p) => p.kind === 'striker');
  if (!striker) throw new RangeError('Board has no striker');
  striker.x = pos.x;
  striker.y = pos.y;
  striker.vx = dir.x * speed;
  striker.vy = dir.y * speed;
  striker.pocketed = false;
  return board;
}

/**
 * Plays a shot in real time: frame time goes into an accumulator and the
 * engine runs whole DT steps. The end state equals simulateShot(...).final.
 */
export function createPlayback(state: BoardState, input: ShotInput): Playback {
  let board = launch(state, input);
  const stepMs = config.DT * 1000;
  const maxSteps = Math.ceil(config.MAX_SHOT_MS / stepMs);
  let n = 0;
  let elapsedMs = 0;
  let done = isAtRest(board);

  return {
    advance(ms: number) {
      const events: ShotEvent[] = [];
      if (done) return { state: board, events, done };
      elapsedMs += Math.min(MAX_FRAME_MS, Math.max(0, ms));
      const target = Math.floor(elapsedMs / stepMs);
      while (n < target && n < maxSteps && !isAtRest(board)) {
        const out = step(board, n * stepMs);
        board = out.state;
        events.push(...out.events);
        n++;
      }
      done = n >= maxSteps || isAtRest(board);
      return { state: board, events, done };
    },
  };
}
