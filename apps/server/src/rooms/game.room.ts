import { randomInt } from 'node:crypto';
import { Room, ServerError, type AuthContext, type Client, type Delayed } from '@colyseus/core';
import { chooseShot } from '@carrom/bot';
import {
  CreateRoomOptionsSchema, lengthOf, MSG, parseClientMessage, type ClientMessage, type ServerMessage,
} from '@carrom/protocol';
import type { Format, GameConfig, Preset } from '@carrom/rules';
import { User } from '../models/user.model.js';
import { findRoomByCode, makeInviteCode } from '../utils/inviteCode.js';
import { verifyToken } from '../utils/jwt.js';
import { newMatch, playShot, rematchOf, ShotRejected, timeOut, type Match } from './gameLogic.js';
import { canSwap, freeSeat, LobbyState, PlayerState, swapped } from './lobbyState.js';
import { DEFAULT_TIMING, ROOM_BOT_LEVEL, type RoomTiming } from './roomTiming.js';

export interface RoomUser { userId: string; name: string; avatar: number }
const CODE_TRIES = 20;

/** ROOM-1..10: a private game room joined by invite code. Use `gameRoomFor` to configure it. */
export class GameRoom extends Room<{ state: LobbyState; metadata: { code: string } }> {
  jwtSecret = '';
  timing: RoomTiming = DEFAULT_TIMING;
  match: Match | null = null;
  /** Seats the server bot plays right now. */
  readonly botSeats = new Set<number>();
  private turnTimer: Delayed | null = null;
  /** When the running shot clock expires (Date.now ms), for a rejoiner's clock. */
  private clockEndsAt = 0;
  private readonly lastAim = new Map<string, number>();
  private readonly lastEmote = new Map<string, number>();

  messages = {
    [MSG]: (client: Client, raw: unknown) => this.receive(client, raw),
  };

  async onCreate(options: unknown): Promise<void> {
    const opts = CreateRoomOptionsSchema.parse(options);
    this.maxClients = opts.format === '1v1' ? 2 : 4;
    let code = makeInviteCode();
    for (let i = 0; i < CODE_TRIES && (await findRoomByCode(code)) !== null; i++) code = makeInviteCode();
    this.state = new LobbyState({
      code, phase: 'lobby', format: opts.format, preset: opts.preset,
      lengthKind: opts.length.kind, target: opts.length.kind === 'points' ? opts.length.target : 0, hostId: '',
    });
    await this.setMetadata({ code });
    await this.setPrivate(true);
  }

  /** ROOM-2: a valid token (guests too) of a user that exists. */
  async onAuth(_client: Client, _options: unknown, context: AuthContext): Promise<RoomUser> {
    const claims = verifyToken(context.token, this.jwtSecret);
    if (!claims) throw new ServerError(401, 'Sign in to play online');
    const user = await User.findById(claims.sub).catch(() => null);
    if (!user) throw new ServerError(401, 'Sign in to play online');
    for (const p of this.state.players.values()) {
      if (p.userId === claims.sub && !p.left) throw new ServerError(409, 'You are already in this room');
    }
    return { userId: claims.sub, name: user.name, avatar: user.avatar };
  }

  onJoin(client: Client, _options: unknown, auth: RoomUser): void {
    if (this.state.phase !== 'lobby') throw new ServerError(409, 'The game has started');
    const seat = freeSeat(this.takenSeats(), this.format());
    if (seat === null) throw new ServerError(409, 'The room is full');
    this.state.players.set(client.sessionId, new PlayerState({
      sessionId: client.sessionId, userId: auth.userId, name: auth.name, avatar: auth.avatar, seat,
      ready: true, bot: false, left: false, rematch: false,
    }));
    if (this.state.hostId === '') this.state.hostId = client.sessionId;
  }

  /** ROOM-8: keep the seat for a while; the seat's turns keep running on the clock. */
  onDrop(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (p) p.ready = false;
    void this.allowReconnection(client, this.timing.reconnectS).catch(() => {});
  }

  onReconnect(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (p) p.ready = true;
    if (this.match) this.sync(client);
  }

  /** Left on purpose, or the reconnect window ran out. */
  onLeave(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (this.state.phase === 'lobby') {
      this.state.players.delete(client.sessionId);
      if (this.state.hostId === client.sessionId) {
        this.state.hostId = [...this.state.players.keys()][0] ?? '';
      }
      return;
    }
    // ROOM-8: the bot keeps the seat for good.
    Object.assign(p, { ready: false, left: true, rematch: false });
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
    // ROOM-7: any message from a person ends a bot takeover of their seat.
    if (p.bot && !p.left) this.setBot(p.seat, false);
    this.handle(client, p, msg);
  }

  private handle(client: Client, p: PlayerState, msg: ClientMessage): void {
    const isHost = this.state.hostId === client.sessionId;
    switch (msg.type) {
      case 'start':
        if (!isHost || this.state.phase !== 'lobby') return this.fail(client, 'NOT_ALLOWED', 'Only the host can start');
        if (this.state.players.size < this.maxClients) return this.fail(client, 'NOT_FULL', 'Wait for every seat');
        return this.startMatch(newMatch({ ...this.config(), seed: randomInt(0x7fffffff) }));
      case 'swap':
        if (!isHost || this.state.phase !== 'lobby' || !canSwap(msg.a, msg.b, this.format())) {
          return this.fail(client, 'NOT_ALLOWED', 'Cannot swap those seats');
        }
        for (const x of this.state.players.values()) x.seat = swapped(x.seat, msg.a, msg.b);
        return;
      case 'shot':
        return this.shoot(client, p.seat, msg.turnId, msg.input);
      case 'aim': {
        if (!this.match || this.match.state.turnSeat !== p.seat || this.throttled(this.lastAim, client, this.timing.aimGapMs)) return;
        const { x, dirX, dirY, power } = msg;
        return this.broadcast(MSG, { type: 'aim', seat: p.seat, x, dirX, dirY, power } satisfies ServerMessage, { except: client });
      }
      case 'emote':
        if (this.throttled(this.lastEmote, client, this.timing.emoteGapMs)) return this.fail(client, 'TOO_FAST', 'One emote every 2 s');
        return this.toAll({ type: 'emote', seat: p.seat, id: msg.id });
      case 'rematch':
        if (this.state.phase !== 'ended') return this.fail(client, 'NOT_ALLOWED', 'The game is not over');
        p.rematch = true;
        return this.checkRematch();
    }
  }

  private shoot(client: Client | null, seat: number, turnId: number, input: Parameters<typeof playShot>[3]): void {
    if (!this.match || this.state.phase !== 'playing') {
      if (client) this.fail(client, 'NOT_PLAYING', 'No game is running');
      return;
    }
    try {
      const out = playShot(this.match, seat, turnId, input);
      this.match = out.match;
      this.toAll(out.message);
      this.nextTurn(out.message.durationMs);
    } catch (err) {
      if (!(err instanceof ShotRejected) || !client) throw err;
      this.fail(client, err.code, err.message);
    }
  }

  // ---- game flow ----

  private startMatch(m: Match): void {
    this.match = m;
    this.state.phase = 'playing';
    for (const p of this.state.players.values()) p.rematch = false;
    void this.lock();
    this.toAll({ type: 'game', state: m.state, turnId: m.turnId });
    this.nextTurn(0);
  }

  /** ROOM-7: after `delayMs` of replay, start the clock, or let the bot play. */
  private nextTurn(delayMs: number): void {
    this.turnTimer?.clear();
    this.turnTimer = null;
    const m = this.match;
    if (!m) return;
    if (m.state.winner !== null) {
      this.state.phase = 'ended';
      return;
    }
    const { turnId } = m;
    if (this.botSeats.has(m.state.turnSeat)) {
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
    if (!this.match || this.match.turnId !== turnId || this.match.state.winner !== null) return;
    const out = timeOut(this.match);
    this.match = out.match;
    this.toAll(out.message);
    for (const e of out.message.ruleEvents) if (e.type === 'botTakeover') this.setBot(e.seat, true);
    this.nextTurn(0);
  }

  private botMove(turnId: number): void {
    const m = this.match;
    if (!m || m.turnId !== turnId || m.state.winner !== null) return;
    const seat = m.state.turnSeat;
    try {
      this.shoot(null, seat, turnId, chooseShot(m.state, ROOM_BOT_LEVEL, randomInt(0x7fffffff)));
    } catch {
      this.expire(turnId);
    }
  }

  /** Bot on or off for a seat; if it is that seat's turn, the turn restarts for the new player. */
  private setBot(seat: number, on: boolean): void {
    const had = this.botSeats.has(seat);
    if (on) this.botSeats.add(seat);
    else this.botSeats.delete(seat);
    for (const p of this.state.players.values()) if (p.seat === seat) p.bot = on;
    if (had !== on && this.match && this.match.state.turnSeat === seat && this.state.phase === 'playing') {
      this.nextTurn(0);
    }
  }

  /** ROOM-9: every person still here voted. */
  private checkRematch(): void {
    if (this.state.phase !== 'ended' || !this.match) return;
    const humans = [...this.state.players.values()].filter((p) => !p.left);
    if (humans.length === 0 || !humans.every((p) => p.rematch)) return;
    for (const p of humans) if (p.bot) this.setBot(p.seat, false);
    this.startMatch(rematchOf(this.match));
  }

  // ---- helpers ----

  /** Full game to one client (reconnect), with the clock still running. */
  private sync(client: Client): void {
    const m = this.match;
    if (!m) return;
    client.send(MSG, { type: 'game', state: m.state, turnId: m.turnId } satisfies ServerMessage);
    const left = this.clockEndsAt - Date.now();
    if (left > 0 && !this.botSeats.has(m.state.turnSeat)) {
      client.send(MSG, { type: 'clock', turnId: m.turnId, ms: left } satisfies ServerMessage);
    }
  }

  private toAll(msg: ServerMessage): void {
    this.broadcast(MSG, msg);
  }

  private fail(client: Client, code: string, message: string): void {
    client.send(MSG, { type: 'error', code, message } satisfies ServerMessage);
  }

  private throttled(last: Map<string, number>, client: Client, gapMs: number): boolean {
    const now = Date.now();
    if (now - (last.get(client.sessionId) ?? -Infinity) < gapMs) return true;
    last.set(client.sessionId, now);
    return false;
  }

  private format(): Format {
    return this.state.format as Format;
  }

  private config(): Omit<GameConfig, 'seed'> {
    return { format: this.format(), preset: this.state.preset as Preset, length: lengthOf(this.state) };
  }

  private takenSeats(): number[] {
    return [...this.state.players.values()].map((p) => p.seat);
  }
}

/** A GameRoom class bound to the JWT secret and timings. */
export function gameRoomFor(jwtSecret: string, timing: RoomTiming = DEFAULT_TIMING): typeof GameRoom {
  return class extends GameRoom {
    jwtSecret = jwtSecret;
    timing = timing;
  };
}
