import { createRack, placeCoin, type BoardState, type Seat, type ShotEvent } from '@carrom/engine';
import { colourBoardPoints, colourGameWinner, resolveColourShot } from './colourGame';
import { RULES } from './constants';
import { pointGameWinner, pointsFor, resolvePointShot } from './pointGame';
import type { Drop } from './red';
import { firstBreakSeat, nextBreakSeat, nextSeat, otherTeam, teamOf } from './turns';
import type { GameConfig, GameState, RuleEvent, Team } from './types';

/** Fresh board: rack for the breaker, colours set, nothing down. */
function startBoard(g: GameState, breakSeat: Seat, boardNo: number): GameState {
  const breakTeam = teamOf(breakSeat, g.config.format);
  const colour = g.config.preset === 'colour';
  return {
    ...g,
    board: createRack(breakSeat),
    turnSeat: breakSeat,
    breakSeat,
    boardNo,
    teamColour: {
      [breakTeam]: colour ? 'white' : null,
      [otherTeam(breakTeam)]: colour ? 'black' : null,
    } as GameState['teamColour'],
    pocketed: { A: [], B: [] },
    redPending: null,
  };
}

export function newGame(cfg: GameConfig): GameState {
  const blank: GameState = {
    config: cfg,
    board: { pieces: [] },
    turnSeat: 0,
    breakSeat: 0,
    teamColour: { A: null, B: null },
    pocketed: { A: [], B: [] },
    redPending: null,
    boardNo: 1,
    scores: { A: 0, B: 0 },
    winner: null,
    timeouts: [0, 0, 0, 0],
  };
  return startBoard(blank, firstBreakSeat(cfg.seed, cfg.format), 1);
}

function dropsOf(events: ShotEvent[], final: BoardState): Drop[] {
  const drops: Drop[] = [];
  for (const e of events) {
    if (e.type !== 'pocket') continue;
    const kind = final.pieces.find((p) => p.id === e.id)?.kind;
    if (kind === 'white' || kind === 'black' || kind === 'red') drops.push({ id: e.id, kind });
  }
  return drops;
}

/** Score the board, then either end the game or rack the next board. */
function finishBoard(g: GameState, winner: Team, events: RuleEvent[]): GameState {
  const colour = g.config.preset === 'colour';
  const points = colour
    ? colourBoardPoints(g, winner, g.pocketed)
    : pointsFor(g.board, g.pocketed[winner]);
  const scores = { ...g.scores };
  if (colour) scores[winner] += points;
  else {
    scores.A += pointsFor(g.board, g.pocketed.A);
    scores.B += pointsFor(g.board, g.pocketed.B);
  }
  events.push({ type: 'boardEnd', winner, points });

  const scored = { ...g, scores };
  const gameWinner = colour ? colourGameWinner(scored, winner) : pointGameWinner(scored, winner);
  if (gameWinner !== null) {
    events.push({ type: 'gameEnd', winner: gameWinner });
    return { ...scored, winner: gameWinner };
  }
  const next = startBoard(scored, nextBreakSeat(g.breakSeat, g.config.format), g.boardNo + 1);
  events.push({ type: 'turn', seat: next.turnSeat });
  return next;
}

/**
 * Apply one shot's result from the engine. Pure: returns a new state.
 * RUL-9: there is no striker penalty, so the striker is ignored here.
 */
export function applyShot(
  g: GameState, events: ShotEvent[], final: BoardState,
): { state: GameState; events: RuleEvent[] } {
  if (g.winner !== null) throw new Error('The game is over');
  const out: RuleEvent[] = [];
  const drops = dropsOf(events, final);
  const outcome = g.config.preset === 'colour'
    ? resolveColourShot(g, drops)
    : resolvePointShot(g, drops);

  // RUL-8: returned coins go on the centre spot or the nearest free point.
  let board = final;
  for (const r of outcome.returns) {
    board = placeCoin(board, r.id);
    out.push({ type: 'returned', id: r.id, reason: r.reason });
  }
  if (outcome.redCoveredBy) out.push({ type: 'redCovered', team: outcome.redCoveredBy });

  const timeouts = [...g.timeouts];
  timeouts[g.turnSeat] = 0;
  const after: GameState = {
    ...g,
    board,
    pocketed: outcome.pocketed,
    redPending: outcome.redPending,
    timeouts,
  };

  if (outcome.boardWinner !== null) {
    return { state: finishBoard(after, outcome.boardWinner, out), events: out };
  }
  // RUL-4: a legal coin keeps the turn. RUL-2: otherwise it passes right.
  const turnSeat = outcome.keepTurn ? g.turnSeat : nextSeat(g.turnSeat, g.config.format);
  out.push({ type: 'turn', seat: turnSeat });
  return { state: { ...after, turnSeat }, events: out };
}

/**
 * RUL-10: the shot clock ran out. The turn passes; a red waiting for cover
 * returns (the missed shot was its chance). After TIMEOUTS_FOR_BOT in a row,
 * emit botTakeover for that seat.
 */
export function applyTimeout(g: GameState): { state: GameState; events: RuleEvent[] } {
  if (g.winner !== null) throw new Error('The game is over');
  const out: RuleEvent[] = [];
  const seat = g.turnSeat;
  const timeouts = [...g.timeouts];
  timeouts[seat] = (timeouts[seat] ?? 0) + 1;

  let board = g.board;
  if (g.redPending !== null) {
    board = placeCoin(board, 'red');
    out.push({ type: 'returned', id: 'red', reason: 'red not covered' });
  }
  if (timeouts[seat] === RULES.TIMEOUTS_FOR_BOT) out.push({ type: 'botTakeover', seat });
  const turnSeat = nextSeat(seat, g.config.format);
  out.push({ type: 'turn', seat: turnSeat });
  return { state: { ...g, board, redPending: null, timeouts, turnSeat }, events: out };
}
