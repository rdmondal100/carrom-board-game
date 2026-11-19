import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import type { ServerMessage } from '@carrom/protocol';
import {
  applyShot, applyTimeout, firstBreakSeat, newGame, nextSeat, type GameConfig, type GameState,
} from '@carrom/rules';

/** A running game in a room: rules state plus the id the next shot must carry. */
export interface Match {
  state: GameState;
  turnId: number;
  /** Seat that broke board 1 (ROOM-9: a rematch starts with the next one). */
  firstBreak: number;
}

export type ShotResultMessage = Extract<ServerMessage, { type: 'shotResult' }>;
export type TimeoutMessage = Extract<ServerMessage, { type: 'timeout' }>;

export type ShotError = 'GAME_OVER' | 'NOT_YOUR_TURN' | 'STALE_TURN' | 'BAD_SHOT';

export class ShotRejected extends Error {
  constructor(readonly code: ShotError, message: string) {
    super(message);
  }
}

export function newMatch(cfg: GameConfig): Match {
  const state = newGame(cfg);
  return { state, turnId: 0, firstBreak: state.breakSeat };
}

/**
 * ROOM-4: run `input` for the player at `seat` claiming `turnId`. Throws
 * ShotRejected (and changes nothing) for a finished game, the wrong seat,
 * a stale turnId, or a shot the engine refuses (blocked baseline).
 */
export function playShot(m: Match, seat: number, turnId: number, input: ShotInput): {
  match: Match; message: ShotResultMessage;
} {
  if (m.state.winner !== null) throw new ShotRejected('GAME_OVER', 'The game is over');
  if (seat !== m.state.turnSeat || input.seat !== seat) {
    throw new ShotRejected('NOT_YOUR_TURN', 'It is not your turn');
  }
  if (turnId !== m.turnId) throw new ShotRejected('STALE_TURN', `Expected turn ${m.turnId}`);
  let sim: ReturnType<typeof simulateShot>;
  try {
    sim = simulateShot(m.state.board, input);
  } catch (err) {
    if (err instanceof RangeError) throw new ShotRejected('BAD_SHOT', err.message);
    throw err;
  }
  const out = applyShot(m.state, sim.events, sim.final);
  return {
    match: { ...m, state: out.state, turnId: m.turnId + 1 },
    message: {
      type: 'shotResult', turnId: m.turnId, seat, input, ruleEvents: out.events,
      stateHash: stateHash(out.state.board), state: out.state, durationMs: sim.durationMs,
    },
  };
}

/** ROOM-7: the shot clock ran out for the seat to move. */
export function timeOut(m: Match): { match: Match; message: TimeoutMessage } {
  const seat = m.state.turnSeat;
  const out = applyTimeout(m.state);
  return {
    match: { ...m, state: out.state, turnId: m.turnId + 1 },
    message: { type: 'timeout', turnId: m.turnId, seat, ruleEvents: out.events, state: out.state },
  };
}

/** Search limit for a seed with a given first breaker; each try hits a seat with p ≥ 1/4. */
const SEED_TRIES = 1000;

/** The first seed after `seed` whose RUL-3 draw makes `seat` break board 1. */
export function seedForBreaker(seed: number, seat: number, format: GameConfig['format']): number {
  for (let i = 1; i <= SEED_TRIES; i++) {
    const s = (seed + i) >>> 0;
    if (firstBreakSeat(s, format) === seat) return s;
  }
  throw new Error(`No seed found for breaker ${seat}`);
}

/** ROOM-9: same settings, new game, the next seat breaks first. */
export function rematchOf(m: Match): Match {
  const cfg = m.state.config;
  const breaker = nextSeat(m.firstBreak, cfg.format);
  return newMatch({ ...cfg, seed: seedForBreaker(cfg.seed, breaker, cfg.format) });
}
