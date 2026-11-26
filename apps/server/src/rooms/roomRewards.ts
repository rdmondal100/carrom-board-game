import type { ServerMessage } from '@carrom/protocol';
import { logger } from '../utils/logger.js';
import { levelUpOf, rewardOnlineGame } from '../utils/wallet.js';
import type { PlayerState } from './lobbyState.js';

/**
 * COS-2 coins for an online game: win or loss per player's team, for everyone
 * still in it (not `left`, not the `skip` session that just abandoned it).
 * `teamOf` comes from the game module; `send` tells each rewarded player what they got
 * (PRG-7 with the XP and any level-up). PRG-3 `game` moves the matching missions.
 */
export function rewardPlayers(
  all: Iterable<PlayerState>, teamOf: (seat: number) => string, winner: string, skip: string, game: string,
  send: (sessionId: string, msg: ServerMessage) => void,
): Promise<void> {
  const players = [...all].filter((p) => !p.left && p.sessionId !== skip);
  return rewardOnlineGame(players.map((p) => ({ userId: p.userId, won: teamOf(p.seat) === winner })), game)
    .then((given) => {
      for (const p of players) {
        const r = given.get(p.userId);
        if (r?.coins) send(p.sessionId, { type: 'reward', coins: r.coins, xp: r.xp, ...levelUpOf(r) });
      }
    })
    .catch((err: unknown) => logger.error('game rewards not saved', err));
}
