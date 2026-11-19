import { simulateShot, type BoardState, type Seat, type ShotInput } from '@carrom/engine';
import {
  applyShot, applyTimeout, newGame, seatsFor,
  type GameConfig, type GameState, type RuleEvent,
} from '@carrom/rules';

/** A same-device game. `names` are in player order: names[i] sits at seatsFor(format)[i]. */
export interface LocalGame { state: GameState; names: string[]; clockOn: boolean }

export function startLocal(cfg: GameConfig, names: string[], clockOn: boolean): LocalGame {
  return { state: newGame(cfg), names: [...names], clockOn };
}

/**
 * LOC-2: run the shot through the engine and the rules. The returned `shot`
 * is what the board replays; its end state equals the engine's final state.
 */
export function shootLocal(g: LocalGame, input: ShotInput): {
  game: LocalGame; shot: { start: BoardState; input: ShotInput }; ruleEvents: RuleEvent[];
} {
  const start = g.state.board;
  const sim = simulateShot(start, input);
  const out = applyShot(g.state, sim.events, sim.final);
  return { game: { ...g, state: out.state }, shot: { start, input }, ruleEvents: out.events };
}

/** LOC-5: the shot clock ran out for the current shooter. */
export function timeoutLocal(g: LocalGame): { game: LocalGame; ruleEvents: RuleEvent[] } {
  const out = applyTimeout(g.state);
  return { game: { ...g, state: out.state }, ruleEvents: out.events };
}

/** Name of the player at `seat`, or '' if nobody sits there. */
export function seatName(g: LocalGame, seat: number): string {
  const i = seatsFor(g.state.config.format).indexOf(seat as Seat);
  return i < 0 ? '' : (g.names[i] ?? '');
}

/** The shooter as an engine seat. */
export function shooterSeat(g: LocalGame): Seat {
  return g.state.turnSeat as Seat;
}

/** A fresh seed for who breaks first. UI only; never used inside a shot. */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
