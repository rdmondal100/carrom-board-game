import { config as engine, pocketCentre, type BoardState, type Kind, type PocketId } from '@carrom/engine';
import { otherTeam, teamOf, type GameState, type RuleEvent } from '@carrom/rules';
import { WEIGHTS } from './config';

const POCKETS: readonly PocketId[] = [0, 1, 2, 3];
const ALL: readonly Kind[] = ['white', 'black', 'red'];
const coinsOnly = (ids: string[]) => ids.filter((id) => id !== 'red');

/** Sum over coins of these kinds: 1 at a pocket centre, 0 at NEAR_POCKET_DIST or further. */
export function nearPockets(board: BoardState, kinds: readonly Kind[]): number {
  const near = WEIGHTS.NEAR_POCKET_DIST;
  let sum = 0;
  for (const p of board.pieces) {
    if (p.pocketed || !kinds.includes(p.kind)) continue;
    let best = 0;
    for (const k of POCKETS) {
      const c = pocketCentre(k, engine);
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const closeness = 1 - Math.sqrt(dx * dx + dy * dy) / near;
      if (closeness > best) best = closeness;
    }
    sum += best;
  }
  return sum;
}

/**
 * BOT-3: how good one simulated shot is for the side that took it.
 * `before` is the state the shot was played from, `after` and `events`
 * come from rules `applyShot`.
 */
export function scoreShot(before: GameState, after: GameState, events: RuleEvent[]): number {
  const seat = before.turnSeat;
  const team = teamOf(seat, before.config.format);
  const opp = otherTeam(team);

  const end = events.find((e) => e.type === 'boardEnd');
  if (end && end.type === 'boardEnd') {
    return end.winner === team ? WEIGHTS.BOARD_WON + end.points : WEIGHTS.BOARD_LOST - end.points;
  }

  const ownDown = coinsOnly(after.pocketed[team]).length - coinsOnly(before.pocketed[team]).length;
  const oppDown = coinsOnly(after.pocketed[opp]).length - coinsOnly(before.pocketed[opp]).length;
  const returned = events.filter((e) => e.type === 'returned').length;
  const covered = events.some((e) => e.type === 'redCovered' && e.team === team);
  const keep = after.turnSeat === seat;
  const pending = after.redPending !== null && after.redPending.seat === seat;

  let s = WEIGHTS.OWN_COIN * ownDown + WEIGHTS.OPP_COIN * oppDown + WEIGHTS.RETURNED * returned;
  if (covered) s += WEIGHTS.RED_COVERED;
  if (pending) s += WEIGHTS.RED_PENDING;
  s += keep ? WEIGHTS.KEEP_TURN : WEIGHTS.TURN_LOST;

  const colour = before.config.preset === 'colour';
  const ownKinds: readonly Kind[] = colour ? [before.teamColour[team] as Kind] : ALL;
  const oppKinds: readonly Kind[] = colour ? [before.teamColour[opp] as Kind, 'red'] : ALL;
  // In the point game every coin is anyone's, so a coin left by a pocket
  // only helps us when we shoot next.
  if (colour || keep) s += WEIGHTS.OWN_NEAR_POCKET * nearPockets(after.board, ownKinds);
  if (!keep) s += WEIGHTS.OPP_NEAR_POCKET * nearPockets(after.board, oppKinds);
  return s;
}
