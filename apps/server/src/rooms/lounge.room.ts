import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { isValidObjectId } from 'mongoose';
import { LOUNGE_MAX, MSG, parseClientMessage, type ServerMessage } from '@carrom/protocol';
import { GroupMember } from '../models/groupMember.model.js';
import { User } from '../models/user.model.js';
import { verifyToken } from '../utils/jwt.js';
import { mayRelay } from './voiceRelay.js';

/** ADDA-5 one person in a group's voice lounge (voice fields as in a game room, VOICE-2). */
export const LoungeMember = schema({
  sessionId: t.string(),
  userId: t.string(),
  name: t.string(),
  avatar: t.uint8(),
  /** Always false: a member who leaves is removed. Kept so the voice relay rule reads the same. */
  left: t.boolean(),
  voiceOn: t.boolean(),
  voiceMuted: t.boolean(),
}, 'LoungeMember');
export type LoungeMember = SchemaType<typeof LoungeMember>;

export const LoungeState = schema({
  groupId: t.string(),
  members: t.map(LoungeMember),
}, 'LoungeState');
export type LoungeState = SchemaType<typeof LoungeState>;

interface LoungeUser { userId: string; name: string; avatar: number }

/**
 * ADDA-5 a group's voice lounge outside games: one room per group
 * (joinOrCreate with { groupId }), members only, a P2P voice mesh of at most
 * LOUNGE_MAX people. Only voice messages are taken; signalling is relayed to
 * the addressed member like in game rooms.
 */
export class LoungeRoom extends Room<{ state: LoungeState }> {
  jwtSecret = '';
  // The size limit is checked in onAuth: a "full" Colyseus room would make joinOrCreate open a second lounge.
  maxClients = 64;

  messages = {
    [MSG]: (client: Client, raw: unknown) => this.receive(client, raw),
  };

  onCreate(options: unknown): void {
    const groupId = (options as { groupId?: unknown } | null)?.groupId;
    if (typeof groupId !== 'string' || !isValidObjectId(groupId)) throw new ServerError(400, 'Unknown group');
    this.state = new LoungeState({ groupId });
  }

  async onAuth(_client: Client, _options: unknown, context: AuthContext): Promise<LoungeUser> {
    const claims = verifyToken(context.token, this.jwtSecret);
    if (!claims) throw new ServerError(401, 'Sign in first');
    const [user, member] = await Promise.all([
      User.findById(claims.sub).catch(() => null),
      GroupMember.exists({ groupId: this.state.groupId, userId: claims.sub }),
    ]);
    if (!user) throw new ServerError(401, 'Sign in first');
    if (!member) throw new ServerError(403, 'Only group members can join the lounge');
    const here = [...this.state.members.values()];
    if (here.some((m) => m.userId === claims.sub)) throw new ServerError(409, 'You are already in the lounge');
    if (here.length >= LOUNGE_MAX) throw new ServerError(409, 'The lounge is full');
    return { userId: claims.sub, name: user.name, avatar: user.avatar };
  }

  onJoin(client: Client, _options: unknown, auth: LoungeUser): void {
    // Two joins can pass onAuth at once; the second one is refused here.
    if (this.state.members.size >= LOUNGE_MAX) throw new ServerError(409, 'The lounge is full');
    this.state.members.set(client.sessionId, new LoungeMember({
      sessionId: client.sessionId, userId: auth.userId, name: auth.name, avatar: auth.avatar,
      left: false, voiceOn: false, voiceMuted: true,
    }));
  }

  onLeave(client: Client): void {
    this.state.members.delete(client.sessionId);
  }

  private receive(client: Client, raw: unknown): void {
    const me = this.state.members.get(client.sessionId);
    const msg = parseClientMessage(raw);
    if (!me || !msg) return;
    if (msg.type === 'voiceState') {
      me.voiceOn = msg.on;
      me.voiceMuted = !msg.on || msg.muted;
    } else if (msg.type === 'voice' && mayRelay(this.state.members, false, client.sessionId, msg.to)) {
      this.clients.getById(msg.to)?.send(MSG, { type: 'voice', from: client.sessionId, signal: msg.signal } satisfies ServerMessage);
    }
  }
}

/** A LoungeRoom class bound to the JWT secret. */
export function loungeRoomFor(jwtSecret: string): typeof LoungeRoom {
  return class extends LoungeRoom {
    jwtSecret = jwtSecret;
  };
}
