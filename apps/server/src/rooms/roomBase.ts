import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { MSG, resolveEquipped, type ClientMessage, type ServerMessage } from '@carrom/protocol';
import type { AnyGameModule } from '@hub/game-kit';
import { User } from '../models/user.model.js';
import { verifyToken } from '../utils/jwt.js';
import { LobbyState, type PlayerState } from './lobbyState.js';
import { DEFAULT_TIMING, type RoomTiming } from './roomTiming.js';
import { mayRelay } from './voiceRelay.js';

type VoiceMessage = Extract<ClientMessage, { type: 'voice' | 'voiceState' }>;

export interface RoomUser { userId: string; name: string; avatar: number; striker: string; coinSet: string } // COS-6 item ids

/**
 * HUB-4: what every game room shares: the game module and its checked
 * settings, sign-in, and sending messages (per-seat views when the game hides
 * information). `GameRoom` adds the lobby and the turn flow on top.
 */
export class RoomBase extends Room<{ state: LobbyState; metadata: { code: string } }> {
  jwtSecret = '';
  timing: RoomTiming = DEFAULT_TIMING;
  /** The game module's state of the running game (null before the first start). */
  match: unknown = null;
  protected game!: AnyGameModule;
  protected gameConfig: unknown = null;
  /** Seats the server bot plays right now. */
  readonly botSeats = new Set<number>();
  /** When the running shot clock expires (Date.now ms), for a rejoiner's clock. */
  protected clockEndsAt = 0;

  /** HUB-4: the game and its (checked) settings; seats come from the module. */
  protected setGame(module: AnyGameModule, rawConfig: unknown): void {
    const cfg = module.configSchema.safeParse(rawConfig);
    if (!cfg.success) throw new ServerError(400, 'Bad game settings');
    this.game = module;
    this.gameConfig = cfg.data;
    this.maxClients = module.seats(cfg.data).length;
  }

  protected lobby(code: string, ranked: boolean): LobbyState {
    return new LobbyState({
      code, phase: 'lobby', gameId: this.game.id, config: JSON.stringify(this.gameConfig), hostId: '', ranked,
    });
  }

  /** ROOM-2: a valid token (guests too) of a user that exists, not already seated here. */
  async onAuth(_client: Client, _options: unknown, context: AuthContext): Promise<RoomUser> {
    const claims = verifyToken(context.token, this.jwtSecret);
    if (!claims) throw new ServerError(401, 'Sign in to play online');
    const user = await User.findById(claims.sub).catch(() => null);
    if (!user) throw new ServerError(401, 'Sign in to play online');
    for (const p of this.state.players.values()) {
      if (p.userId === claims.sub && !p.left) throw new ServerError(409, 'You are already in this room');
    }
    const eq = resolveEquipped(user.cosmetics?.equipped ?? []);
    return { userId: claims.sub, name: user.name, avatar: user.avatar, striker: eq.striker, coinSet: eq.coins };
  }

  /** Full game to one client (reconnect), with the clock still running. */
  protected sync(client: Client): void {
    const m = this.match;
    if (m === null) return;
    const seat = this.state.players.get(client.sessionId)?.seat ?? null;
    client.send(MSG, { type: 'game', view: this.game.view(m, seat), turnId: this.game.turnId(m) } satisfies ServerMessage);
    const left = this.clockEndsAt - Date.now();
    if (left > 0 && !this.botSeats.has(this.game.turnSeat(m))) {
      client.send(MSG, { type: 'clock', turnId: this.game.turnId(m), ms: left } satisfies ServerMessage);
    }
  }

  /**
   * HUB-5: send a message built around a view of the game. Without hidden
   * information everyone gets the same message; with it, each client gets the
   * view of their own seat.
   */
  protected toViews(build: (view: unknown) => ServerMessage): void {
    const m = this.match;
    if (!this.game.hasHiddenInfo) {
      this.toAll(build(this.game.view(m, null)));
      return;
    }
    for (const c of this.clients) {
      const seat = this.state.players.get(c.sessionId)?.seat ?? null;
      c.send(MSG, build(this.game.view(m, seat)));
    }
  }

  /**
   * VOICE-2: `voiceState` updates the player's synced voice fields (everyone
   * sees them); `voice` signalling goes to the addressed session only, and
   * is dropped quietly when it may not go there (VOICE-4, other room, gone).
   */
  protected voice(client: Client, p: PlayerState, msg: VoiceMessage): void {
    if (msg.type === 'voiceState') {
      if (p.left) return;
      p.voiceOn = msg.on;
      p.voiceMuted = !msg.on || msg.muted;
      return;
    }
    if (!mayRelay(this.state.players, this.state.ranked, client.sessionId, msg.to)) return;
    this.clients.getById(msg.to)?.send(MSG, { type: 'voice', from: client.sessionId, signal: msg.signal } satisfies ServerMessage);
  }

  protected toAll(msg: ServerMessage): void {
    this.broadcast(MSG, msg);
  }

  protected fail(client: Client, code: string, message: string): void {
    client.send(MSG, { type: 'error', code, message } satisfies ServerMessage);
  }

  protected seats(): readonly number[] {
    return this.game.seats(this.gameConfig);
  }

  protected teamOf(seat: number): string {
    return this.game.teamOf(this.gameConfig, seat);
  }
}
