import type { BotLevel } from '@hub/game-kit';
import {
  applyLudoMove, ludoBot, ludoModule, ludoTimeout, newLudo, seatsOf, teamOf,
  type LudoConfig, type LudoEvent, type LudoMove, type LudoState,
} from '@hub/ludo';

/** Who plays a seat in a same-device game. */
export type Seating = 'human' | BotLevel;
export const SEATINGS: readonly Seating[] = ['human', 'easy', 'medium', 'hard'];

/** LUDO-6 a same-device game: the rules state plus names and who plays each seat (indexed by seat 0..3). */
export interface LocalLudo {
  state: LudoState;
  names: string[];
  players: Seating[];
  clockOn: boolean;
  /** LUDO-4 seats the bot took over after two timeouts (until "take back control"). */
  takeover: number[];
}

export interface Step { game: LocalLudo; events: LudoEvent[] }

export const newSeed = (): number => Math.floor(Math.random() * 0x7fffffff);

/** A new game. `names` and `players` are per seat 0..3 (seats not playing are ignored). */
export function startLocal(config: LudoConfig, names: string[], players: Seating[], clockOn: boolean, seed = newSeed()): LocalLudo {
  return { state: newLudo(config, seed), names, players, clockOn, takeover: [] };
}

/** Is the seat on turn played by the computer (a bot seat, or one taken over)? */
export function botTurn(g: LocalLudo): BotLevel | null {
  const seat = g.state.turnSeat;
  if (g.takeover.includes(seat)) return 'medium';
  const p = g.players[seat] ?? 'human';
  return p === 'human' ? null : p;
}

export function humanSeats(g: LocalLudo): number[] {
  return seatsOf(g.state.config).filter((s) => (g.players[s] ?? 'human') === 'human');
}

/** A move for the seat on turn (a person's tap, or the bot's pick). Null when refused. */
export function moveLocal(g: LocalLudo, move: LudoMove): Step | null {
  const out = applyLudoMove(g.state, g.state.turnSeat, g.state.turnId, move);
  if (!out.ok) return null;
  return { game: { ...g, state: out.state }, events: out.events };
}

/** The bot's move for the seat on turn. */
export function botMove(g: LocalLudo, seed: number): Step | null {
  const level = botTurn(g) ?? 'medium';
  return moveLocal(g, ludoBot(g.state, g.state.turnSeat, level, seed));
}

/** LUDO-4 the clock ran out: auto-move; two in a row and the bot takes the seat. */
export function timeoutLocal(g: LocalLudo): Step {
  const out = ludoTimeout(g.state);
  const add = ludoModule.takeovers(out.events).filter((s) => !g.takeover.includes(s));
  return { game: { ...g, state: out.state, takeover: [...g.takeover, ...add] }, events: out.events };
}

/** "Take back control" after a takeover. */
export function takeBack(g: LocalLudo, seat: number): LocalLudo {
  return { ...g, takeover: g.takeover.filter((s) => s !== seat), state: { ...g.state, timeouts: g.state.timeouts.map((n, i) => (i === seat ? 0 : n)) } };
}

/** Same settings, a fresh game; the next seat rolls first. */
export function rematchLocal(g: LocalLudo): LocalLudo {
  return { ...g, state: ludoModule.rematch(g.state), takeover: [] };
}

export const seatName = (names: readonly string[], seat: number): string => names[seat] ?? '';

/** A winner's label: a seat's name, or both partners' names in 2v2. */
export function winnerLabel(config: LudoConfig, names: readonly string[], winner: string): string {
  return seatsOf(config).filter((s) => teamOf(config, s) === winner).map((s) => seatName(names, s)).join(' & ');
}

/** Clock on, a person on turn, no winner yet: the clock runs. */
export const clockRuns = (g: LocalLudo): boolean => g.clockOn && g.state.winner === null && botTurn(g) === null;

/** COS-2 a vs-bot game: did the people's side win? Null when people sit on several sides (no reward) or none. */
export function vsBotResult(g: LocalLudo): boolean | null {
  const { config, winner } = g.state;
  if (winner === null) return null;
  const sides = new Set(humanSeats(g).map((s) => teamOf(config, s)));
  const hasBot = seatsOf(config).some((s) => (g.players[s] ?? 'human') !== 'human');
  const [side] = [...sides];
  return sides.size === 1 && hasBot && side !== undefined ? side === winner : null;
}
