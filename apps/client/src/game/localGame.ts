import type { BotLevel } from '@carrom/bot';
import { simulateShot, type BoardState, type Seat, type ShotInput } from '@carrom/engine';
import {
  applyShot, applyTimeout, newGame, seatsFor, teamOf,
  type GameConfig, type GameState, type RuleEvent, type Team,
} from '@carrom/rules';

/** Who plays a seat: a person on this device, or a bot at a level (BOT-6). */
export type Seating = 'human' | BotLevel;
export const SEATINGS: readonly Seating[] = ['human', 'easy', 'medium', 'hard'];

/** BOT-7: the level a bot plays at when it takes over a timed-out seat. */
export const TAKEOVER_LEVEL: BotLevel = 'medium';

/**
 * A same-device game. `names` and `players` are in player order:
 * names[i] / players[i] sit at seatsFor(format)[i]. `takeover` lists seats a
 * bot is playing for a human after RUL-10 (until "take back control").
 */
export interface LocalGame {
  state: GameState;
  names: string[];
  clockOn: boolean;
  players: Seating[];
  takeover: number[];
}

export function startLocal(
  cfg: GameConfig, names: string[], clockOn: boolean, players: readonly Seating[] = [],
): LocalGame {
  return {
    state: newGame(cfg),
    names: [...names],
    clockOn,
    players: names.map((_, i) => players[i] ?? 'human'),
    takeover: [],
  };
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

/** LOC-5: the shot clock ran out. BOT-7: on botTakeover a bot plays that seat. */
export function timeoutLocal(g: LocalGame): { game: LocalGame; ruleEvents: RuleEvent[] } {
  const out = applyTimeout(g.state);
  let game: LocalGame = { ...g, state: out.state };
  for (const e of out.events) {
    if (e.type === 'botTakeover') game = takeOver(game, e.seat);
  }
  return { game, ruleEvents: out.events };
}

function playerIndex(g: LocalGame, seat: number): number {
  return seatsFor(g.state.config.format).indexOf(seat as Seat);
}

/** Name of the player at `seat`, or '' if nobody sits there. */
export function seatName(g: LocalGame, seat: number): string {
  const i = playerIndex(g, seat);
  return i < 0 ? '' : (g.names[i] ?? '');
}

/** The bot level playing `seat` (its own or a takeover), or null for a person. */
export function botLevelAt(g: LocalGame, seat: number): BotLevel | null {
  const own = g.players[playerIndex(g, seat)] ?? 'human';
  if (own !== 'human') return own;
  return g.takeover.includes(seat) ? TAKEOVER_LEVEL : null;
}

/** BOT-7: a bot starts playing for the person at `seat`. */
export function takeOver(g: LocalGame, seat: number): LocalGame {
  if (botLevelAt(g, seat) !== null) return g;
  return { ...g, takeover: [...g.takeover, seat] };
}

/** BOT-7: "take back control". */
export function takeBack(g: LocalGame, seat: number): LocalGame {
  return { ...g, takeover: g.takeover.filter((s) => s !== seat) };
}

/** The shooter as an engine seat. */
export function shooterSeat(g: LocalGame): Seat {
  return g.state.turnSeat as Seat;
}

/** A fresh seed for who breaks first or a bot's noise. UI only; never used inside a shot. */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * COS-2: a Vs-bot game's result for the people on this device: true = won,
 * false = lost, null = no reward (no bot, or people on both sides).
 */
export function vsBotResult(g: LocalGame, winner: Team): boolean | null {
  const { format } = g.state.config;
  const humanTeams = new Set<Team>();
  seatsFor(format).forEach((seat, i) => { if ((g.players[i] ?? 'human') === 'human') humanTeams.add(teamOf(seat, format)); });
  const [team] = [...humanTeams];
  return humanTeams.size === 1 && team !== undefined ? team === winner : null;
}
