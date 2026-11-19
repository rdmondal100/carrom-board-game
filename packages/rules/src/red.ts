import type { GameState, ShotOutcome } from './types';

/** One coin that dropped this shot. */
export interface Drop {
  id: string;
  kind: 'white' | 'black' | 'red';
}

export interface RedResult {
  covered: boolean;
  pending: GameState['redPending'];
  returns: ShotOutcome['returns'];
  /** True when red was due for cover and wasn't covered (RUL-6). */
  forcePass: boolean;
  /** Red is sitting on the board after this shot (not covered, not pending). */
  onBoard: boolean;
}

/**
 * Red rules shared by both presets.
 * RUL-5: red is legal only once the shooter's side has a coin down this
 * board (a coin in the same shot counts). Early red returns to centre.
 * RUL-6: red must be covered by a legal coin in the same shot or the next;
 * otherwise red returns and the turn passes.
 */
export function resolveRed(
  g: GameState, drops: Drop[], legalCoins: number, sideCoinsBefore: number,
): RedResult {
  const alreadyCovered = g.pocketed.A.includes('red') || g.pocketed.B.includes('red');
  const redDropped = drops.some((d) => d.kind === 'red');
  const out: RedResult = { covered: false, pending: null, returns: [], forcePass: false, onBoard: false };

  if (g.redPending !== null) {
    if (legalCoins > 0) out.covered = true;
    else {
      out.returns.push({ id: 'red', reason: 'red not covered' });
      out.forcePass = true;
    }
  } else if (redDropped) {
    if (sideCoinsBefore === 0 && legalCoins === 0) {
      out.returns.push({ id: 'red', reason: 'red before a coin' });
    } else if (legalCoins > 0) {
      out.covered = true;
    } else {
      out.pending = { seat: g.turnSeat, shotsLeft: 1 };
    }
  }
  out.onBoard = !alreadyCovered && !out.covered && out.pending === null;
  return out;
}
