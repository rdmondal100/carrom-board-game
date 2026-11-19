import { RULES } from './constants';
import { resolveRed, type Drop } from './red';
import { otherTeam, teamOf } from './turns';
import type { GameState, ShotOutcome, Team } from './types';

const coinsOnly = (ids: string[]) => ids.filter((id) => id !== 'red');

/**
 * Preset A, the colour game. The breaking side plays white.
 * Legal coin = own colour (+ red under RUL-5). An opponent's coin stays down
 * and counts for them; the turn passes unless an own coin also dropped.
 * RUL-7: a side may not pocket its last coin while red is on the board —
 * that coin returns and the turn passes. The same holds when the shooter
 * pockets the opponent's last coin; with red off the board, that coin wins
 * the board for the opponent.
 */
export function resolveColourShot(g: GameState, drops: Drop[]): ShotOutcome {
  const team = teamOf(g.turnSeat, g.config.format);
  const opp = otherTeam(team);
  const own = drops.filter((d) => d.kind === g.teamColour[team]).map((d) => d.id);
  const theirs = drops.filter((d) => d.kind === g.teamColour[opp]).map((d) => d.id);
  const ownBefore = coinsOnly(g.pocketed[team]).length;
  const oppBefore = coinsOnly(g.pocketed[opp]).length;

  const red = resolveRed(g, drops, own.length, ownBefore);
  const returns = [...red.returns];
  let forcePass = red.forcePass;

  let ownKept = own;
  if (red.onBoard && ownBefore + own.length >= RULES.COINS_PER_COLOUR) {
    returns.push({ id: own.at(-1) as string, reason: 'last coin while red is on the board' });
    ownKept = own.slice(0, -1);
    forcePass = true;
  }
  let theirsKept = theirs;
  if (red.onBoard && oppBefore + theirs.length >= RULES.COINS_PER_COLOUR) {
    returns.push({ id: theirs.at(-1) as string, reason: 'last coin while red is on the board' });
    theirsKept = theirs.slice(0, -1);
    forcePass = true;
  }

  const pocketed = { A: [...g.pocketed.A], B: [...g.pocketed.B] };
  pocketed[team].push(...ownKept);
  pocketed[opp].push(...theirsKept);
  if (red.covered) pocketed[team].push('red');

  let boardWinner: Team | null = null;
  if (coinsOnly(pocketed[team]).length >= RULES.COINS_PER_COLOUR) boardWinner = team;
  else if (coinsOnly(pocketed[opp]).length >= RULES.COINS_PER_COLOUR) boardWinner = opp;

  return {
    pocketed,
    returns,
    redPending: red.pending,
    redCoveredBy: red.covered ? team : null,
    keepTurn: !forcePass && (ownKept.length > 0 || red.pending !== null),
    boardWinner,
  };
}

/**
 * Winner scores 1 per opponent coin left + RED_BONUS if the winner covered
 * red, except red adds nothing once the winner's score ≥ target − 5.
 */
export function colourBoardPoints(
  g: GameState, winner: Team, pocketed: Record<Team, string[]>,
): number {
  const loser = otherTeam(winner);
  const left = RULES.COINS_PER_COLOUR - coinsOnly(pocketed[loser]).length;
  const length = g.config.length;
  const redCounts =
    pocketed[winner].includes('red') &&
    (length.kind === 'board' || g.scores[winner] < length.target - RULES.RED_CUTOFF_MARGIN);
  return left + (redCounts ? RULES.RED_BONUS : 0);
}

/** One board, first to the target, or after MAX_BOARDS the side ahead. */
export function colourGameWinner(g: GameState, boardWinner: Team): Team | null {
  const length = g.config.length;
  if (length.kind === 'board') return boardWinner;
  if (g.scores[boardWinner] >= length.target) return boardWinner;
  if (g.boardNo >= RULES.MAX_BOARDS && g.scores.A !== g.scores.B) {
    return g.scores.A > g.scores.B ? 'A' : 'B';
  }
  return null;
}
