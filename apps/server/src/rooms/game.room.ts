import { randomInt } from 'node:crypto';
import { ServerError, type Client, type Delayed } from '@colyseus/core';
import { CreateRoomOptionsSchema, MSG, parseClientMessage, type ClientMessage, type ServerMessage } from '@carrom/protocol';
import { uniqueInviteCode } from '../utils/inviteCode.js';
import { gameEntry } from './games.js';
import { botPlayer, canSwap, freeSeat, isFilledBot, PlayerState, swapped } from './lobbyState.js';
import { RoomBase, type RoomUser } from './roomBase.js';
import { rewardPlayers } from './roomRewards.js';
import { DEFAULT_TIMING, ROOM_BOT_LEVEL, throttled, type RoomTiming } from './roomTiming.js';

export type { RoomUser } from './roomBase.js';

/**
 * ROOM-1..10 / HUB-4: a private game room joined by invite code, for any
 * registered game. The room runs the lobby, seats, clock, bot takeover,
 * rematch and rejoin; the game module decides everything about play.
 * Use `gameRoomFor` to configure it.
 */
export class GameRoom extends RoomBase {
  protected turnTimer: Delayed | null = null;
  /** COS-2 the last game's coin rewards (tests await it). */
  pendingRewards: Promise<void> | null = null;
  private readonly lastHint = new Map<string, number>();
  private readonly lastEmote = new Map<string, number>();
  private botIds = 0;

  messages = {
    [MSG]: (client: Client, raw: unknown) => this.receive(client, raw),
  };

  async onCreate(options: unknown): Promise<void> {
    const opts = CreateRoomOptionsSchema.safeParse(options);
    const entry = opts.success ? gameEntry(opts.data.gameId) : null;
    if (!opts.success || !entry) throw new ServerError(400, 'Unknown game');
    this.setGame(entry.module, opts.data.config);
    const code = await uniqueInviteCode();
    this.state = this.lobby(code, false);
    await this.setMetadata({ code });
    await this.setPrivate(true);
  }

  onJoin(client: Client, _options: unknown, auth: RoomUser): void {
    if (this.state.phase !== 'lobby') throw new ServerError(409, 'The game has started');
    const seat = this.seatFor(auth);
    if (seat === null) throw new ServerError(409, 'The room is full');
    this.state.players.set(client.sessionId, new PlayerState({
      sessionId: client.sessionId, userId: auth.userId, name: auth.name, avatar: auth.avatar, seat,
      ready: true, bot: false, left: false, rematch: false, striker: auth.striker, coinSet: auth.coinSet,
      voiceOn: false, voiceMuted: true,
    }));
    if (this.state.hostId === '' && !this.state.ranked) this.state.hostId = client.sessionId;
  }

  /** ROOM-3: seats fill in join order. */
  protected seatFor(_auth: RoomUser): number | null {
    return freeSeat([...this.state.players.values()].map((p) => p.seat), this.seats());
  }

  /** ROOM-8: keep the seat for a while; the seat's turns keep running on the clock. */
  onDrop(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (p) Object.assign(p, { ready: false, voiceOn: false, voiceMuted: true });
    void this.allowReconnection(client, this.timing.reconnectS).catch(() => {});
  }

  onReconnect(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (p) p.ready = true;
    if (this.match !== null) this.sync(client);
  }

  /** Left on purpose, or the reconnect window ran out. */
  onLeave(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (this.state.phase === 'lobby') {
      this.state.players.delete(client.sessionId);
      if (this.state.hostId === client.sessionId) this.state.hostId = [...this.state.players.values()].find((x) => !x.left)?.sessionId ?? '';
      return;
    }
    // ROOM-8: the bot keeps the seat for good.
    Object.assign(p, { ready: false, left: true, rematch: false, voiceOn: false, voiceMuted: true });
    if (![...this.state.players.values()].some((x) => !x.left)) {
      void this.disconnect();
      return;
    }
    this.setBot(p.seat, true);
    this.checkRematch();
  }

  onDispose(): void {
    this.turnTimer?.clear();
  }

  // ---- messages ----

  private receive(client: Client, raw: unknown): void {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const msg = parseClientMessage(raw);
    if (!msg) return this.fail(client, 'BAD_MESSAGE', 'Message not understood');
    if (!this.allows(msg)) return this.fail(client, 'NOT_ALLOWED', 'Not in this room');
    // VOICE-2: voice is not a move, so it never ends a bot takeover.
    if (msg.type === 'voice' || msg.type === 'voiceState') return this.voice(client, p, msg);
    // ROOM-7: any message from a person ends a bot takeover of their seat.
    if (p.bot && !p.left) this.setBot(p.seat, false);
    this.handle(client, p, msg);
  }

  /** Message types this kind of room takes (a ranked room refuses lobby and rematch ones). */
  protected allows(_msg: ClientMessage): boolean { return true; }

  private handle(client: Client, p: PlayerState, msg: ClientMessage): void {
    const isHost = this.state.hostId === client.sessionId;
    switch (msg.type) {
      case 'start':
        if (!isHost || this.state.phase !== 'lobby') return this.fail(client, 'NOT_ALLOWED', 'Only the host can start');
        if (this.state.players.size < this.maxClients) return this.fail(client, 'NOT_FULL', 'Wait for every seat');
        return this.startMatch(this.game.newGame(this.gameConfig, randomInt(0x7fffffff)));
      case 'swap':
        if (!isHost || this.state.phase !== 'lobby' || !canSwap(msg.a, msg.b, this.seats())) {
          return this.fail(client, 'NOT_ALLOWED', 'Cannot swap those seats');
        }
        for (const x of this.state.players.values()) x.seat = swapped(x.seat, msg.a, msg.b);
        return;
      case 'seatBot':
        return this.seatBot(client, isHost, msg.seat, msg.on);
      case 'move': {
        const move = this.game.moveSchema.safeParse(msg.move);
        if (!move.success) return this.fail(client, 'BAD_MOVE', 'Move not understood');
        this.play(client, p.seat, msg.turnId, move.data);
        return;
      }
      case 'hint': {
        // ROOM-6: live hints (carrom's aim) only from the seat on turn, throttled.
        const hint = this.game.hintSchema?.safeParse(msg.data);
        if (!hint?.success || this.match === null || this.game.turnSeat(this.match) !== p.seat) return;
        if (throttled(this.lastHint, client.sessionId, this.timing.aimGapMs)) return;
        return this.broadcast(MSG, { type: 'hint', seat: p.seat, data: hint.data } satisfies ServerMessage, { except: client });
      }
      case 'emote':
        if (throttled(this.lastEmote, client.sessionId, this.timing.emoteGapMs)) return this.fail(client, 'TOO_FAST', 'One emote every 2 s');
        return this.toAll({ type: 'emote', seat: p.seat, id: msg.id });
      case 'rematch':
        if (this.state.phase !== 'ended') return this.fail(client, 'NOT_ALLOWED', 'The game is not over');
        p.rematch = true;
        return this.checkRematch();
    }
  }

  /** CB-8 the host puts a bot in an empty seat of the lobby, or takes one out. */
  private seatBot(client: Client, isHost: boolean, seat: number, on: boolean): void {
    const at = [...this.state.players.values()].find((x) => x.seat === seat);
    const ok = isHost && this.state.phase === 'lobby' && this.seats().includes(seat) && (on ? !at : at !== undefined && isFilledBot(at));
    if (!ok) return this.fail(client, 'NOT_ALLOWED', on ? 'That seat is not free' : 'No bot in that seat');
    if (on) this.state.players.set(`bot-${++this.botIds}`, botPlayer(`bot-${this.botIds}`, seat));
    else this.state.players.delete(at!.sessionId);
  }

  /** Run a move for `seat`. False when refused (the client, if any, is told why). */
  private play(client: Client | null, seat: number, turnId: number, move: unknown): boolean {
    if (this.match === null || this.state.phase !== 'playing') {
      if (client) this.fail(client, 'NOT_PLAYING', 'No game is running');
      return false;
    }
    const out = this.game.applyMove(this.match, seat, turnId, move);
    if (!out.ok) {
      if (client) this.fail(client, out.code, out.message);
      return false;
    }
    this.match = out.state;
    // CB-5 a hidden-information game's hash covers the hands, so it never leaves the server.
    const hash = this.game.hasHiddenInfo ? '' : this.game.hash(out.state);
    this.toViews((view) => ({
      type: 'moveResult', turnId, seat, move, events: out.events, hash, view, durationMs: out.durationMs,
    }));
    this.nextTurn(out.durationMs * this.timing.replayScale);
    return true;
  }

  // ---- game flow ----

  protected startMatch(m: unknown): void {
    this.match = m;
    this.state.phase = 'playing';
    for (const p of this.state.players.values()) {
      p.rematch = false;
      if (p.left) this.botSeats.add(p.seat); // CB-8 seats the host gave to bots
    }
    void this.lock();
    const turnId = this.game.turnId(m);
    this.toViews((view) => ({ type: 'game', view, turnId }));
    this.nextTurn(0);
  }

  /** ROOM-7: after `delayMs` of replay, start the clock, or let the bot play. */
  private nextTurn(delayMs: number): void {
    this.turnTimer?.clear();
    this.turnTimer = null;
    const m = this.match;
    if (m === null) return;
    const result = this.game.result(m);
    if (result) {
      this.state.phase = 'ended';
      this.onGameEnd(result.winner);
      return;
    }
    const turnId = this.game.turnId(m);
    if (this.botSeats.has(this.game.turnSeat(m))) {
      const think = this.timing.botMinMs + randomInt(Math.max(1, this.timing.botMaxMs - this.timing.botMinMs));
      this.turnTimer = this.clock.setTimeout(() => this.botMove(turnId), delayMs + think);
      return;
    }
    this.turnTimer = this.clock.setTimeout(() => {
      this.clockEndsAt = Date.now() + this.timing.shotClockMs;
      this.toAll({ type: 'clock', turnId, ms: this.timing.shotClockMs });
      this.turnTimer = this.clock.setTimeout(() => this.expire(turnId), this.timing.shotClockMs + this.timing.graceMs);
    }, delayMs);
  }

  private expire(turnId: number): void {
    const m = this.match;
    if (m === null || this.game.turnId(m) !== turnId || this.game.result(m)) return;
    const out = this.game.timeout(m);
    this.match = out.state;
    this.toViews((view) => ({ type: 'timeout', turnId, seat: out.seat, events: out.events, view }));
    for (const seat of this.game.takeovers(out.events)) this.setBot(seat, true);
    this.nextTurn(0);
  }

  private botMove(turnId: number): void {
    const m = this.match;
    if (m === null || this.game.turnId(m) !== turnId || this.game.result(m)) return;
    const seat = this.game.turnSeat(m);
    let ok: boolean;
    try {
      ok = this.play(null, seat, turnId, this.game.bot(m, seat, ROOM_BOT_LEVEL, randomInt(0x7fffffff)));
    } catch {
      ok = false;
    }
    // A bot that can't move (or makes a refused move) times out like a person would.
    if (!ok) this.expire(turnId);
  }

  /** Bot on or off for a seat; if it is that seat's turn, the turn restarts for the new player. */
  private setBot(seat: number, on: boolean): void {
    const had = this.botSeats.has(seat);
    if (on) this.botSeats.add(seat);
    else this.botSeats.delete(seat);
    for (const p of this.state.players.values()) if (p.seat === seat) p.bot = on;
    if (had !== on && this.match !== null && this.game.turnSeat(this.match) === seat && this.state.phase === 'playing') {
      this.nextTurn(0);
    }
  }

  /** ROOM-9: every person still here voted. */
  private checkRematch(): void {
    if (this.state.phase !== 'ended' || this.match === null) return;
    const humans = [...this.state.players.values()].filter((p) => !p.left);
    if (humans.length === 0 || !humans.every((p) => p.rematch)) return;
    for (const p of humans) if (p.bot) this.setBot(p.seat, false);
    this.startMatch(this.game.rematch(this.match));
  }

  /** A game just ended with a winning team. Private rooms keep no record; they only give coins. */
  protected onGameEnd(winner: string): void { this.rewardGame(winner); }

  /** COS-2 coins for everyone still in the game (not `skip`, a session that just abandoned it). */
  protected rewardGame(winner: string, skip = ''): void {
    // CB-8 a game against the host's bots alone pays nothing online (Vs bot has its own daily cap).
    if ([...this.state.players.values()].filter((p) => !isFilledBot(p)).length < 2) return;
    this.pendingRewards = rewardPlayers(this.state.players.values(), (seat) => this.teamOf(seat), winner, skip,
      (id, msg) => this.clients.getById(id)?.send(MSG, msg));
  }
}

/** A GameRoom class bound to the JWT secret and timings. */
export function gameRoomFor(jwtSecret: string, timing: RoomTiming = DEFAULT_TIMING): typeof GameRoom {
  return class extends GameRoom {
    jwtSecret = jwtSecret;
    timing = timing;
  };
}
