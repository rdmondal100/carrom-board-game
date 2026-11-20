import { randomInt } from 'node:crypto';
import { ServerError, type AuthContext, type Client } from '@colyseus/core';
import { MSG, type ClientMessage, type ServerMessage } from '@carrom/protocol';
import { teamOf, type Team } from '@carrom/rules';
import { logger } from '../utils/logger.js';
import { DEFAULT_RANKED_TIMING, RANKED_OPTIONS, type RankedTiming } from '../utils/rankedConfig.js';
import { GameRoom, type RoomUser } from './game.room.js';
import { newMatch } from './gameLogic.js';
import { LobbyState } from './lobbyState.js';
import { recordMatch } from './matchResult.js';
import { parseRankedCreate, rankedSeat } from './ranked.js';
import { DEFAULT_TIMING, type RoomTiming } from './roomTiming.js';

/**
 * RANK-2 / RANK-4: a 1v1 ranked game the matchmaker made for two players with
 * reserved seats. Starts when both are in, has no rematch, saves the result
 * once, and a player who leaves and doesn't come back in time loses.
 */
export class RankedGameRoom extends GameRoom {
  rankedTiming: RankedTiming = DEFAULT_RANKED_TIMING;
  /** RANK-4 the result write (tests await it). */
  pendingResult: Promise<void> | null = null;
  /** The two user ids, in seat order. */
  private players: [string, string] = ['', ''];
  private recorded = false;
  /** Sent again to a player who rejoins after the game. */
  private lastResult: ServerMessage | null = null;

  async onCreate(options: unknown): Promise<void> {
    const players = parseRankedCreate(options);
    if (!players) throw new ServerError(403, 'Ranked rooms are made by the matchmaker');
    this.players = players;
    this.maxClients = 2;
    const o = RANKED_OPTIONS;
    this.state = new LobbyState({
      code: '', phase: 'lobby', format: o.format, preset: o.preset, lengthKind: o.length.kind, target: 0,
      hostId: '', ranked: true,
    });
    await this.setPrivate(true);
    this.clock.setTimeout(() => {
      if (this.state.phase !== 'lobby') return;
      this.toAll({ type: 'error', code: 'NO_OPPONENT', message: 'Your opponent did not join' });
      void this.disconnect();
    }, this.rankedTiming.joinWaitMs);
  }

  async onAuth(client: Client, options: unknown, context: AuthContext): Promise<RoomUser> {
    const user = await super.onAuth(client, options, context);
    if (!this.players.includes(user.userId)) throw new ServerError(403, 'This game is not yours');
    return user;
  }

  onJoin(client: Client, options: unknown, auth: RoomUser): void {
    super.onJoin(client, options, auth);
    if (this.state.players.size === this.maxClients) {
      this.startMatch(newMatch({ ...this.config(), seed: randomInt(0x7fffffff) }));
    }
  }

  protected seatFor(auth: RoomUser): number | null {
    return rankedSeat(this.players, auth.userId);
  }

  onReconnect(client: Client): void {
    super.onReconnect(client);
    if (this.lastResult) client.send(MSG, this.lastResult);
  }

  /** RANK-4: leaving a running game for good (reconnect window over) loses it. */
  onLeave(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (p && this.state.phase === 'playing') {
      this.state.phase = 'ended';
      this.turnTimer?.clear();
      this.finish(teamOf(p.seat, this.format()) === 'A' ? 'B' : 'A', true, p.sessionId);
    }
    super.onLeave(client);
  }

  protected allows(msg: ClientMessage): boolean {
    return msg.type !== 'start' && msg.type !== 'swap' && msg.type !== 'rematch';
  }

  protected onGameEnd(winner: Team): void {
    this.finish(winner, false);
  }

  /** RANK-4 / RANK-5: save once, then tell both players their new ratings. COS-2 coins (not for the leaver). */
  private finish(winner: Team, abandoned: boolean, leaver = ''): void {
    const m = this.match;
    if (!m || this.recorded) return;
    this.recorded = true;
    this.rewardGame(winner, leaver);
    const players = [...this.state.players.values()].map((p) => ({ userId: p.userId, name: p.name, seat: p.seat }));
    this.pendingResult = recordMatch({
      matchId: this.roomId, ranked: true, format: this.format(), winner, boards: m.state.boardNo, abandoned, players,
    }).then((changes) => {
      this.lastResult = { type: 'rankedResult', winner, abandoned, players: changes };
      this.toAll(this.lastResult);
    }).catch((err: unknown) => logger.error('ranked result not saved', err));
  }
}

/** A RankedGameRoom class bound to the JWT secret and timings. */
export function rankedRoomFor(
  jwtSecret: string, timing: RoomTiming = DEFAULT_TIMING, rankedTiming: RankedTiming = DEFAULT_RANKED_TIMING,
): typeof RankedGameRoom {
  return class extends RankedGameRoom {
    jwtSecret = jwtSecret;
    timing = timing;
    rankedTiming = rankedTiming;
  };
}
