import type { ServerMessage } from '@carrom/protocol';
import { logger } from '../utils/logger.js';
import { rewardOnlineGame } from '../utils/wallet.js';
import type { PlayerState } from './lobbyState.js';

/**
 * COS-2 coins for an online game: win or loss per player's team, for everyone
 * still in it (not `left`, not the `skip` session that just abandoned it).
 * `teamOf` comes from the game module; `send` tells each rewarded player what they got.
 */
export function rewardPlayers(
  all: Iterable<PlayerState>, teamOf: (seat: number) => string, winner: string, skip: string,
  send: (sessionId: string, msg: ServerMessage) => void,
): Promise<void> {
  const players = [...all].filter((p) => !p.left && p.sessionId !== skip);
  return rewardOnlineGame(players.map((p) => ({ userId: p.userId, won: teamOf(p.seat) === winner })))
    .then((given) => {
      for (const p of players) {
        const coins = given.get(p.userId);
        if (coins) send(p.sessionId, { type: 'reward', coins });
      }
    })
    .catch((err: unknown) => logger.error('game rewards not saved', err));
}
