import type { BotLevel } from '@hub/game-kit';
import {
  applyNodiMove, nodiBot, nodiParModule, nodiTimeout, newNodi, seatsOf, teamOf,
  type NodiConfig, type NodiEvent, type NodiMove, type NodiState,
} from '@hub/nodipar';

/** Who plays a seat in a same-device game. */
export type Seating = 'human' | BotLevel;
export const SEATINGS: readonly Seating[] = ['human', 'easy', 'medium', 'hard'];

/** NODI-5 a same-device / vs-bot game: the rules state plus names and who plays each seat (indexed by seat 0..3). */
export interface LocalNodi {
  state: NodiState;
  names: string[];
  players: Seating[];
  clockOn: boolean;
  /** Seats the bot took over after two timeouts (until "take back control"). */
  takeover: number[];
}

/** A move that was played: the state it started from, who moved, the move, and what happened. */
export interface Step { game: LocalNodi; from: NodiState; seat: number; move: NodiMove | null; events: NodiEvent[] }

export const newSeed = (): number => Math.floor(Math.random() * 0x7fffffff);

export function startLocal(config: NodiConfig, names: string[], players: Seating[], clockOn: boolean, seed = newSeed()): LocalNodi {
  return { state: newNodi(config, seed), names, players, clockOn, takeover: [] };
}

/** Is the seat on turn played by the computer (a bot seat, or one taken over)? */
export function botTurn(g: LocalNodi): BotLevel | null {
  const seat = g.state.turnSeat;
  if (g.takeover.includes(seat)) return 'medium';
  const p = g.players[seat] ?? 'human';
  return p === 'human' ? null : p;
}

export function humanSeats(g: LocalNodi): number[] {
  return seatsOf(g.state.config).filter((s) => (g.players[s] ?? 'human') === 'human');
}

/** A move for the seat on turn (a person's flick, or the bot's pick). Null when refused. */
export function moveLocal(g: LocalNodi, move: NodiMove): Step | null {
  const seat = g.state.turnSeat;
  const out = applyNodiMove(g.state, seat, g.state.turnId, move);
  if (!out.ok) return null;
  return { game: { ...g, state: out.state }, from: g.state, seat, move, events: out.events };
}

export function botMove(g: LocalNodi, seed: number): Step | null {
  const level = botTurn(g) ?? 'medium';
  return moveLocal(g, nodiBot(g.state, g.state.turnSeat, level, seed));
}

/** The clock ran out: that move is lost; two in a row and the bot takes the seat. */
export function timeoutLocal(g: LocalNodi): Step {
  const out = nodiTimeout(g.state);
  const add = nodiParModule.takeovers(out.events).filter((s) => !g.takeover.includes(s));
  return { game: { ...g, state: out.state, takeover: [...g.takeover, ...add] }, from: g.state, seat: out.seat, move: null, events: out.events };
}

export function takeBack(g: LocalNodi, seat: number): LocalNodi {
  return { ...g, takeover: g.takeover.filter((s) => s !== seat), state: { ...g.state, timeouts: g.state.timeouts.map((n, i) => (i === seat ? 0 : n)) } };
}

/** Same settings, a fresh match; the next seat moves first. */
export function rematchLocal(g: LocalNodi): LocalNodi {
  return { ...g, state: nodiParModule.rematch(g.state), takeover: [] };
}

export const seatName = (names: readonly string[], seat: number): string => names[seat] ?? '';

/** A side's label: a seat's name, or both partners' names in 2v2. */
export function sideLabel(config: NodiConfig, names: readonly string[], team: string): string {
  return seatsOf(config).filter((s) => teamOf(config, s) === team).map((s) => seatName(names, s)).join(' & ');
}

export const clockRuns = (g: LocalNodi): boolean => g.clockOn && g.state.winner === null && botTurn(g) === null;

/** COS-2 a vs-bot game: did the people's side win? Null when people sit on both sides (no reward) or none. */
export function vsBotResult(g: LocalNodi): boolean | null {
  const { config, winner } = g.state;
  if (winner === null) return null;
  const sides = new Set(humanSeats(g).map((s) => teamOf(config, s)));
  const hasBot = seatsOf(config).some((s) => (g.players[s] ?? 'human') !== 'human');
  const [side] = [...sides];
  return sides.size === 1 && hasBot && side !== undefined ? side === winner : null;
}
