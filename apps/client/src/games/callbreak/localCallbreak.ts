import type { BotLevel } from '@hub/game-kit';
import {
  applyCallbreakMove, callbreakBot, callbreakModule, callbreakTimeout, callbreakView, newCallbreak,
  type CallbreakConfig, type CallbreakEvent, type CallbreakMove, type CallbreakState, type CallbreakView,
} from '@hub/callbreak';

/** CB-7 you always sit at seat 0 against three bots. */
export const ME = 0;
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

/** A vs-bot game: the rules state, names per seat, each bot's level (seat 0's entry unused). */
export interface LocalCallbreak {
  state: CallbreakState;
  names: string[];
  levels: BotLevel[];
  clockOn: boolean;
  /** CB-4 your seat was taken over after two timeouts (until "take back control"). */
  takeover: boolean;
}

export interface Step { game: LocalCallbreak; events: CallbreakEvent[] }

export const newSeed = (): number => Math.floor(Math.random() * 0x7fffffff);

export function startLocal(config: CallbreakConfig, names: string[], levels: BotLevel[], clockOn: boolean, seed = newSeed()): LocalCallbreak {
  return { state: newCallbreak(config, seed), names, levels, clockOn, takeover: false };
}

/** What you see: your own hand and the table (the bots read only their own views too). */
export const myView = (g: LocalCallbreak): CallbreakView => callbreakView(g.state, ME);

/** The computer plays the seat on turn: a bot seat, or yours after a takeover. */
export function botTurn(g: LocalCallbreak): BotLevel | null {
  if (g.state.winner !== null) return null;
  const seat = g.state.turnSeat;
  if (seat === ME) return g.takeover ? 'medium' : null;
  return g.levels[seat] ?? 'medium';
}

/** A move for the seat on turn. Null when refused. */
export function moveLocal(g: LocalCallbreak, move: CallbreakMove): Step | null {
  const out = applyCallbreakMove(g.state, g.state.turnSeat, g.state.turnId, move);
  return out.ok ? { game: { ...g, state: out.state }, events: out.events } : null;
}

export function botMove(g: LocalCallbreak, seed: number): Step | null {
  const seat = g.state.turnSeat;
  return moveLocal(g, callbreakBot(callbreakView(g.state, seat), botTurn(g) ?? 'medium', seed));
}

/** CB-4 your clock ran out: a move is made for you; two in a row and the bot takes your seat. */
export function timeoutLocal(g: LocalCallbreak): Step {
  const out = callbreakTimeout(g.state);
  const taken = callbreakModule.takeovers(out.events).includes(ME);
  return { game: { ...g, state: out.state, takeover: g.takeover || taken }, events: out.events };
}

export function takeBack(g: LocalCallbreak): LocalCallbreak {
  return { ...g, takeover: false, state: { ...g.state, timeouts: g.state.timeouts.map((n, i) => (i === ME ? 0 : n)) } };
}

/** Same settings, a fresh deal; the next seat deals. */
export function rematchLocal(g: LocalCallbreak): LocalCallbreak {
  return { ...g, state: callbreakModule.rematch(g.state), takeover: false };
}

/** Clock on, your turn, game on: the clock runs. */
export const clockRuns = (g: LocalCallbreak): boolean => g.clockOn && botTurn(g) === null && g.state.winner === null;

/** COS-2 did you win (top total)? Null while the game runs. */
export const vsBotResult = (g: LocalCallbreak): boolean | null => (g.state.winner === null ? null : g.state.winner === String(ME));
