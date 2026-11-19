import type { BoardState } from '@carrom/engine';
import { RULES } from './constants';
import { resolveRed, type Drop } from './red';
import { teamOf } from './turns';
import type { GameState, ShotOutcome, Team } from './types';

const coinsOnly = (ids: string[]) => ids.filter((id) => id !== 'red');

/**
 * Preset B, the point game. Any coin is legal for either side and counts
 * for the shooter's side. Red still needs cover (RUL-5, RUL-6). RUL-7 here:
 * nobody may pocket the last white/black coin while red is on the board.
 * The board ends when every coin is down.
 */
export function resolvePointShot(g: GameState, drops: Drop[]): ShotOutcome {
  const team = teamOf(g.turnSeat, g.config.format);
  const coins = drops.filter((d) => d.kind !== 'red').map((d) => d.id);
  const before = coinsOnly(g.pocketed[team]).length;

  const red = resolveRed(g, drops, coins.length, before);
  const returns = [...red.returns];
  let forcePass = red.forcePass;

  const onBoardBefore = g.board.pieces.filter(
    (p) => (p.kind === 'white' || p.kind === 'black') && !p.pocketed,
  ).length;
  let kept = coins;
  if (red.onBoard && coins.length > 0 && onBoardBefore - coins.length <= 0) {
    returns.push({ id: coins.at(-1) as string, reason: 'last coin while red is on the board' });
    kept = coins.slice(0, -1);
    forcePass = true;
  }

  const pocketed = { A: [...g.pocketed.A], B: [...g.pocketed.B] };
  pocketed[team].push(...kept);
  if (red.covered) pocketed[team].push('red');

  const total = 2 * RULES.COINS_PER_COLOUR;
  const allDown =
    coinsOnly(pocketed.A).length + coinsOnly(pocketed.B).length >= total &&
    (pocketed.A.includes('red') || pocketed.B.includes('red'));

  let boardWinner: Team | null = null;
  if (allDown) {
    boardWinner = pointsFor(g.board, pocketed.A) > pointsFor(g.board, pocketed.B) ? 'A' : 'B';
  }

  return {
    pocketed,
    returns,
    redPending: red.pending,
    redCoveredBy: red.covered ? team : null,
    keepTurn: !forcePass && (kept.length > 0 || red.pending !== null),
    boardWinner,
  };
}

/** White 10, black 5, red 20. A full board is 155. */
export function pointsFor(board: BoardState, ids: string[]): number {
  return ids.reduce((sum, id) => {
    const kind = board.pieces.find((p) => p.id === id)?.kind;
    return kind === 'white' || kind === 'black' || kind === 'red'
      ? sum + RULES.POINT_VALUE[kind]
      : sum;
  }, 0);
}

/** One board, or the first side at the target when a board ends. */
export function pointGameWinner(g: GameState, boardWinner: Team): Team | null {
  const length = g.config.length;
  if (length.kind === 'board') return boardWinner;
  const top = Math.max(g.scores.A, g.scores.B);
  if (top < length.target || g.scores.A === g.scores.B) return null;
  return g.scores.A > g.scores.B ? 'A' : 'B';
}
