// HUB-3: carrom as a GameModule. This is the old server `rooms/gameLogic.ts`
// behaviour, moved here unchanged; engine, rules and bot are not touched.
import { chooseShot } from '@carrom/bot';
import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import { AimHintSchema, CarromRoomConfigSchema, ShotInputSchema, type AimHint, type CarromRoomConfig } from '@carrom/protocol';
import {
  applyShot, applyTimeout, firstBreakSeat, newGame, nextSeat, seatsFor, teamOf,
  type GameConfig, type GameState, type RuleEvent,
} from '@carrom/rules';
import { refuse, type GameModule, type MoveOutcome } from '@hub/game-kit';

/** A running carrom game: rules state plus the id the next shot must carry. */
export interface CarromMatch {
  state: GameState;
  turnId: number;
  /** Seat that broke board 1 (ROOM-9: a rematch starts with the next one). */
  firstBreak: number;
}

export function newMatch(cfg: GameConfig): CarromMatch {
  const state = newGame(cfg);
  return { state, turnId: 0, firstBreak: state.breakSeat };
}

/**
 * ROOM-4: run `input` for the player at `seat` claiming `turnId`. Refuses (and
 * changes nothing) a finished game, the wrong seat, a stale turnId, or a shot
 * the engine refuses (blocked baseline).
 */
export function playShot(m: CarromMatch, seat: number, turnId: number, input: ShotInput): MoveOutcome<CarromMatch, RuleEvent> {
  if (m.state.winner !== null) return refuse('GAME_OVER', 'The game is over');
  if (seat !== m.state.turnSeat || input.seat !== seat) return refuse('NOT_YOUR_TURN', 'It is not your turn');
  if (turnId !== m.turnId) return refuse('STALE_TURN', `Expected turn ${m.turnId}`);
  let sim: ReturnType<typeof simulateShot>;
  try {
    sim = simulateShot(m.state.board, input);
  } catch (err) {
    if (err instanceof RangeError) return refuse('BAD_MOVE', err.message);
    throw err;
  }
  const out = applyShot(m.state, sim.events, sim.final);
  return { ok: true, state: { ...m, state: out.state, turnId: m.turnId + 1 }, events: out.events, durationMs: sim.durationMs };
}

/** ROOM-7: the shot clock ran out for the seat to move. */
export function timeOut(m: CarromMatch): { state: CarromMatch; seat: number; events: RuleEvent[] } {
  const seat = m.state.turnSeat;
  const out = applyTimeout(m.state);
  return { state: { ...m, state: out.state, turnId: m.turnId + 1 }, seat, events: out.events };
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
export function rematchOf(m: CarromMatch): CarromMatch {
  const cfg = m.state.config;
  const breaker = nextSeat(m.firstBreak, cfg.format);
  return newMatch({ ...cfg, seed: seedForBreaker(cfg.seed, breaker, cfg.format) });
}

const roomConfig = (s: CarromMatch): CarromRoomConfig =>
  ({ format: s.state.config.format, preset: s.state.config.preset, length: s.state.config.length });

/** HUB-3 carrom on the hub's game contract. Views are the whole game (no hidden information). */
export const carromModule: GameModule<CarromRoomConfig, CarromMatch, ShotInput, RuleEvent, GameState, AimHint> = {
  id: 'carrom',
  hasHiddenInfo: false,
  configSchema: CarromRoomConfigSchema,
  moveSchema: ShotInputSchema,
  hintSchema: AimHintSchema,
  seats: (c) => seatsFor(c.format),
  teamOf: (c, seat) => teamOf(seat, c.format),
  configOf: roomConfig,
  newGame: (c, seed) => newMatch({ ...c, seed }),
  rematch: rematchOf,
  applyMove: playShot,
  timeout: timeOut,
  takeovers: (events) => events.flatMap((e) => (e.type === 'botTakeover' ? [e.seat] : [])),
  turnSeat: (s) => s.state.turnSeat,
  turnId: (s) => s.turnId,
  result(s) {
    const w = s.state.winner;
    if (w === null) return null;
    const c = s.state.config;
    return { winner: w, placings: seatsFor(c.format).map((seat) => (teamOf(seat, c.format) === w ? 1 : 2)) };
  },
  view: (s) => s.state,
  hash: (s) => stateHash(s.state.board),
  rounds: (s) => s.state.boardNo,
  bot: (s, _seat, level, seed) => chooseShot(s.state, level, seed),
};
