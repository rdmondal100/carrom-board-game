import type { GroupPlayers, StartGroupRoomResponse } from '@carrom/protocol';
import { GroupMember } from '../models/groupMember.model.js';
import { logger } from '../utils/logger.js';
import { createGroupRoom, UnknownGameError } from './groupRoom.js';
import { isFilledBot, type PlayerState } from './lobbyState.js';
import { recordMatch } from './matchResult.js';

export type NextRoomOutcome = { ok: true; room: StartGroupRoomResponse } | { ok: false; code: string; message: string };

/**
 * ADDA-3 / ADDA-4 what a game room does for its group: record each finished
 * game for the group page and leaderboard, and move everyone on to the next
 * game. A room without a group (`id` = '') records nothing and refuses moves.
 */
export class GroupLink {
  id = '';
  /** The last game's save (tests await it). */
  saving: Promise<void> | null = null;
  private games = 0;
  private moving = false;

  /** ADDA-3 save a finished game (unranked: ratings don't change). Host bots are not players. */
  gameEnded(roomId: string, game: string, winner: string, boards: number, seated: Iterable<PlayerState>, teamOf: (seat: number) => string): void {
    if (this.id === '') return;
    this.moving = false;
    const players = [...seated].filter((p) => !isFilledBot(p)).map((p) => ({
      userId: p.userId, name: p.name, seat: p.seat, team: teamOf(p.seat),
    }));
    this.saving = recordMatch({
      matchId: `${roomId}:${++this.games}`, game, ranked: false, winner, boards, abandoned: false, players, groupId: this.id,
    }).then(() => undefined).catch((err: unknown) => logger.error('group game not saved', err));
  }

  /** ADDA-4 a member, after the game ended, asks for a new room of `gameId`; one move per ended game. */
  async next(userId: string, gameId: string, players: GroupPlayers, ended: boolean): Promise<NextRoomOutcome> {
    if (this.id === '' || !ended || this.moving) {
      return { ok: false, code: 'NOT_ALLOWED', message: 'Pick the next game after this one ends' };
    }
    this.moving = true;
    const out = await this.make(userId, gameId, players);
    if (!out.ok) this.moving = false;
    return out;
  }

  private async make(userId: string, gameId: string, players: GroupPlayers): Promise<NextRoomOutcome> {
    if (!(await GroupMember.exists({ groupId: this.id, userId }))) {
      return { ok: false, code: 'NOT_ALLOWED', message: 'Only group members can pick the next game' };
    }
    try {
      return { ok: true, room: await createGroupRoom(this.id, gameId, players) };
    } catch (err) {
      if (err instanceof UnknownGameError) return { ok: false, code: 'BAD_GAME', message: 'Unknown game' };
      logger.error('next group room failed', err);
      return { ok: false, code: 'FAILED', message: 'Could not make the next room' };
    }
  }
}
